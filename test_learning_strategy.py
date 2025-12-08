import sys
sys.path.append('backend')

import pandas as pd
from backend.ml.roadmap_generator import RoadmapGenerator
from backend.ml.learning_strategy import LearningStrategyGenerator

# Load Skill Data
print("\nLoading skill data")
try:
    skill_df = pd.read_csv("Skill.csv")
    print(f"Loaded {len(skill_df)} skills from Skill.csv")
except FileNotFoundError:
    print("Skill.csv not found!")
    print("Please make sure Skill.csv exists in the root directory")
    sys.exit(1)

# Initialize Roadmap Generator
print("\nInitializing Roadmap Generator...")
roadmap_gen = RoadmapGenerator()
roadmap_gen.load_data(skill_df)
train_acc, test_acc = roadmap_gen.train_model()

print(f"Model trained successfully!")
print(f"   Train accuracy: {train_acc*100:.2f}%")
print(f"   Test accuracy: {test_acc*100:.2f}%")

# Initialize Strategy Generator
print("\nInitializing Learning Strategy Generator")

# API key
GEMINI_API_KEY = "AIzaSyC9IZj0_dZ8nSVwjm6FGo1urmnaZQdJViM"

try:
    strategy_gen = LearningStrategyGenerator(
        api_key=GEMINI_API_KEY,
        resources_path="data.json"
    )
    print("Strategy generator initialized!")
except Exception as e:
    print(f"Failed to initialize: {e}")
    sys.exit(1)

# Test Full Pipeline
print("\n" + "="*80)
print("TESTING FULL PIPELINE")
print("="*80)

test_cases = [
    {
        "query": "sehabis css, apa lagi yang harus dipelajari untuk jadi front-end web developer?",
        "goal": "Menjadi Front-End Developer profesional"
    }
]

for i, test_case in enumerate(test_cases, 1):
    print(f"\n{'='*80}")
    print(f"TEST CASE #{i}")
    print(f"{'='*80}")
    print(f"Query: {test_case['query']}")
    if test_case['goal']:
        print(f"Goal: {test_case['goal']}")
    print("-"*80)
    
    try:
        result = strategy_gen.generate_from_query(
            query=test_case['query'],
            roadmap_generator=roadmap_gen,
            goal=test_case['goal'],
            top_n=5
        )
        
        print(f"\nNext Skills Detected:")
        for idx, skill in enumerate(result["next_skills"], 1):
            print(f"  {idx}. {skill}")
        
        print(f"\n" + "="*80)
        print("LEARNING STRATEGY")
        print("="*80)
        print(result["strategy"])
        
    except Exception as e:
        print(f"Test failed: {e}")
    
    print("\n")

# Test Direct Strategy Generation
print("="*80)
print("TESTING DIRECT STRATEGY GENERATION")
print("="*80)

direct_test = {
    "next_skills": ["JavaScript", "React", "TypeScript"],
    "goal": "Menjadi Full-Stack Developer"
}

print(f"\nNext Skills: {', '.join(direct_test['next_skills'])}")
print(f"Goal: {direct_test['goal']}")
print("-"*80)

try:
    # Set dataframe for level detection
    if strategy_gen.df is None:
        strategy_gen.df = roadmap_gen.df
    
    strategy = strategy_gen.generate_actionable_learning_strategy(
        next_skills=direct_test["next_skills"],
        goal=direct_test["goal"]
    )
    
    print("\n" + "="*80)
    print("LEARNING STRATEGY")
    print("="*80)
    print(strategy)
    
except Exception as e:
    print(f"Test failed: {e}")

print("ALL TESTS COMPLETED!")