from __future__ import annotations

import json
from typing import List, Optional, Dict, Any
import os
import pandas as pd

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False
    print("google-generativeai not installed. Install with: pip install google-generativeai")


class LearningStrategyGenerator:
    def __init__(self, api_key: str, resources_path: str = "data.json"):
        if not GENAI_AVAILABLE:
            raise ImportError("google-generativeai required! Install with: pip install google-generativeai")
        
        self.api_key = api_key
        self.resources = []
        self.df = None  
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-lite")
        
        # Load resources
        try:
            with open(resources_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.resources = data.get("resources", [])
            print(f"Loaded {len(self.resources)} resources from {resources_path}")
        except Exception as e:
            print(f"Failed to load resources: {e}")
            self.resources = []
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(f"models/{self.model_name}")
        print(f"Gemini model initialized ({self.model_name})")
    
    def _get_skill_level_nums(self, next_skills: List[str]) -> List[int]:
        if self.df is None:
            return [1] * len(next_skills)
        
        level_nums = []
        for skill in next_skills:
            row = self.df[self.df["skill"] == skill]
            if not row.empty:
                level_nums.append(row["level_num"].iloc[0])
            else:
                # Fallback: coba match partial
                for _, r in self.df.iterrows():
                    if skill.lower() in r["skill"].lower():
                        level_nums.append(r["level_num"])
                        break
        
        return level_nums if level_nums else [1]
    
    def _get_references_text(self, next_skills: List[str], max_per_skill: int = 2) -> str:
        references_text = ""
        
        for i, skill in enumerate(next_skills, start=1):
            # Filter resource yang judulnya mengandung skill
            skill_resources = [
                r for r in self.resources 
                if skill.lower() in r.get("title", "").lower()
            ][:max_per_skill]
            
            if skill_resources:
                references_text += f"{i}. {skill}:\n"
                for r in skill_resources:
                    title = r.get("title", "Unknown")
                    url = r.get("url", "#")
                    res_type = r.get("type", "Resource")
                    references_text += f"  - {title} ({res_type})\n    {url}\n"
        
        return references_text
    
    def generate_actionable_learning_strategy(
        self, 
        next_skills: List[str], 
        goal: Optional[str] = None,
        user_profile: Optional[str] = None,
        progress_summary: Optional[str] = None,
    ) -> str:
        next_text = ", ".join(next_skills)
        level_nums = self._get_skill_level_nums(next_skills)
        level_num = min(level_nums) if level_nums else 1
        references_text = self._get_references_text(next_skills)
        profile_text = f"\nProfil pengguna: {user_profile}" if user_profile else ""
        progress_text = f"\nRingkasan progres: {progress_summary}" if progress_summary else ""
        
        # Build prompt 
        prompt = f"""
Kamu adalah mentor belajar yang praktis dan terstruktur. Gunakan bahasa yang tidak terlalu baku, semangat, ramah, dan ceria.
Buat strategi belajar harian untuk seseorang yang ingin mempelajari skill: {next_text} {f"dengan tujuan akhir: {goal}" if goal else ""}.{profile_text}{progress_text}
Berikan saran output subskill berdasarkan level skill yang sudah terdeteksi: {level_nums}.
Format output harus persis seperti ini.
Yuk naikin skill kamu! Ini rencana belajar yang bakal nge-boost perkembanganmu! ⚡
1️. <Nama Skill>:
  - <Subskill>
  - <Subskill>
  - <Subskill>
  dst.

Tips seru supaya belajar makin efektif 💡
(Pilih 3 tips belajar secara acak. Harus berikan 1 tips teknik belajar populer.
Tips boleh berasal dari kebiasaan belajar, trik fokus, pengaturan lingkungan, manajemen waktu, mindset positif, atau cara mencatat yang efektif.
Setiap tips harus sangat singkat, maksimal 2 kalimat pendek, tidak lebih dari 10 kata.)
- <Tips 1>
- <Tips 2>
- <Tips 3>

Referensi buat kamu 📚
(Resource yang dikeluarkan hanya berdasarkan skill: {next_text}. Dilarang menambahkan resource selain di sini)
{references_text}

Berikut roadmap belajar mingguanmu 😉
Atur jadwal sesuai aturan berikut:
1. Fokus pada satu skill utama terlebih dahulu sebelum pindah ke skill berikutnya.
2. Jika dalam satu hari hanya ada 1 subskill → berikan 1 durasi belajar (durasi bebas).
3. Jika dalam satu hari ada lebih dari 1 subskill → berikan durasi untuk masing-masing subskill (setiap durasi bebas).
4. Durasi belajar harus realistis dan logis berdasarkan tingkat kesulitan subskill.
5. Durasi belajar menggunakan format lama waktu, bukan jam pada pukul tertentu.
Durasi belajar harus dalam format lama waktu saja: "45 menit", "1 jam", "90 menit", "2 jam", dst. Tidak boleh menggunakan kombinasi jam + menit (misal: "1 jam 30 menit" dilarang).
Format jadwal harus persis seperti ini:
- Hari 1: <Durasi 1> → <Skill>: <Subskill 1>
  Hari 1: <Durasi 2> → <Skill>: <Subskill 2> (jika ada)
- Hari 2: <Durasi> → <Skill>: <Subskill>
dst.
"""
        
        try:
            response = self.model.generate_content(prompt)
            strategy_text = response.text
            
            # Remove markdown bold formatting (seperti di notebook)
            strategy_text = strategy_text.replace("**", "")
            
            return strategy_text
        
        except Exception as e:
            return f"Error generating strategy: {e}"
    
    def generate_from_query(
        self,
        query: str,
        roadmap_generator,
        goal: Optional[str] = None,
        top_n: int = 5,
        user_profile: Optional[str] = None,
        progress_summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full pipeline: dari query → next skills → strategi
        
        Args:
            query: User query (e.g., "sehabis CSS, apa lagi yang harus dipelajari?")
            roadmap_generator: Instance dari RoadmapGenerator
            goal: Tujuan akhir (optional)
            top_n: Jumlah next skills yang direkomendasikan
        
        Returns:
            Dictionary berisi next_skills, next_skills_details, dan strategy
        """
        # Set dataframe untuk level detection
        if self.df is None and hasattr(roadmap_generator, 'df'):
            self.df = roadmap_generator.df
        
        # Predict next skills
        next_skills_df = roadmap_generator.predict_next_skills(query, top_n=top_n)
        
        if next_skills_df.empty:
            return {
                "query": query,
                "next_skills": [],
                "next_skills_details": [],
                "strategy": "No next skill recommendations found."
            }
        
        # Extract skill names (remove parentheses content)
        next_skills = [
            s.split("(")[0].strip() 
            for s in next_skills_df["skill"].tolist()
        ]
        
        # Generate strategy
        strategy = self.generate_actionable_learning_strategy(
            next_skills,
            goal,
            user_profile=user_profile,
            progress_summary=progress_summary,
        )
        
        return {
            "query": query,
            "next_skills": next_skills,
            "next_skills_details": next_skills_df.to_dict('records'),
            "strategy": strategy
        }

# EXAMPLE
if __name__ == "__main__":
    # Import harus ada di direktori yang sama
    try:
        from roadmap_generator import RoadmapGenerator
    except ImportError:
        print("Error: roadmap_generator.py tidak ditemukan!")
        print("Pastikan file roadmap_generator.py ada di direktori yang sama")
        exit(1)
    
    # 1. Setup Roadmap Generator
    print("Loading skill data")
    try:
        skill_df = pd.read_csv("Skill.csv")
    except FileNotFoundError:
        print("Error: Skill.csv tidak ditemukan!")
        print("Pastikan file Skill.csv ada di direktori yang sama")
        exit(1)
    
    roadmap_gen = RoadmapGenerator()
    roadmap_gen.load_data(skill_df)
    roadmap_gen.train_model()
    
    # 2. Setup Strategy Generator
    print("\nInitializing Learning Strategy Generator")
    
    # API KEY
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    if not GEMINI_API_KEY:
        raise SystemExit("Set GEMINI_API_KEY di environment sebelum menjalankan contoh ini.")
    
    try:
        strategy_gen = LearningStrategyGenerator(
            api_key=GEMINI_API_KEY,
            resources_path="data.json"
        )
    except FileNotFoundError:
        print("Warning: data.json tidak ditemukan, melanjutkan tanpa references")
        strategy_gen = LearningStrategyGenerator(
            api_key=GEMINI_API_KEY,
            resources_path="data.json"
        )
    
    # 3. Full Pipeline Example
    print("\n" + "="*60)
    print("FULL PIPELINE EXAMPLE")
    print("="*60)
    
    query = "sehabis css, apa lagi yang harus dipelajari untuk jadi front-end web developer?"
    goal = "Menjadi Front-End Developer profesional"
    
    print(f"\nQuery: {query}")
    print(f"Goal: {goal}")
    print("\nGenerating strategy (ini bisa memakan waktu 10-30 detik)...\n")
    
    result = strategy_gen.generate_from_query(
        query=query,
        roadmap_generator=roadmap_gen,
        goal=goal,
        top_n=5
    )
    
    print(f"\nNext Skills Recommended: {', '.join(result['next_skills'])}")
    print(f"\n{'='*60}")
    print("LEARNING STRATEGY:")
    print('='*60)
    print(result['strategy'])
    
