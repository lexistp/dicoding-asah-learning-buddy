import sys
sys.path.append('backend')

import pandas as pd
from backend.ml.roadmap_generator import RoadmapGenerator

# Load data (sesuaikan dengan file Anda)
print("\nLoading skill data")
try:
    # Coba load dari CSV
    skill_df = pd.read_csv("Skill.csv")
except:
    # Atau dari Excel
    from backend.services.data_loader import load_excel_as_records
    skill_df = pd.DataFrame(
        load_excel_as_records("Resource Data Learning Buddy.xlsx", "Skill Keywords")
    )

# Initialize
generator = RoadmapGenerator()
generator.load_data(skill_df)

# Train model
print("\nTraining model...")
train_acc, test_acc = generator.train_model()

# Test queries 
test_queries = [
    "sehabis HTML, apa lagi yang harus dipelajari untuk jadi web developer?"
]

print("\n" + "="*80)
print("TESTING QUERIES")
print("="*80)

for q in test_queries:
    print(f"\n{'='*70}")
    print(f"Query: {q}")
    print(f"{'='*70}")
    
    result = generator.predict_next_skills(q, top_n=5)
    
    if not result.empty:
        print(result.to_string(index=False))
    else:
        print("No recommendations found.")
    print()

print("COMPLETED!")