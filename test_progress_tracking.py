import sys
sys.path.append('backend')

import pandas as pd
from backend.services.data_loader import load_excel_as_records
from backend.ml.student_progress import HybridLearningRecommender

# Load data
print("\nLoading datasets")
lp_answer = pd.DataFrame(load_excel_as_records("Resource Data Learning Buddy.xlsx", "Learning Path Answer"))
course = pd.DataFrame(load_excel_as_records("LP and Course Mapping.xlsx", "Course"))
stud_progress = pd.DataFrame(load_excel_as_records("Resource Data Learning Buddy.xlsx", "Student Progress"))
tutorials = pd.DataFrame(load_excel_as_records("LP and Course Mapping.xlsx", "Tutorials"))

# Initialize
recommender = HybridLearningRecommender()

# Prepare data
print("Preparing data")
try:
    course_features, stud_metrics, course_data = recommender.prepare_data(
        lp_answer, course, stud_progress, tutorials
    )
    print(f"Data prepared successfully")
    print(f"   - Course features: {len(course_features)} rows")
    print(f"   - Student metrics: {len(stud_metrics)} rows")
    print(f"   - Course data: {len(course_data)} rows")
    print(f"   - Level mapping: {recommender.level_mapping}")
except Exception as e:
    print(f"Error preparing data: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Build models
print("\nBuilding models...")
recommender.build_content_based_model(course_features)
model, train_acc, test_acc = recommender.build_classification_model(stud_metrics)

print(f"\nTraining Accuracy: {train_acc*100:.2f}%")
print(f"Testing Accuracy: {test_acc*100:.2f}%")

# Print results
print("\n" + "="*80)
print("STUDENT RESULTS")
print("="*80)

success_count = 0
error_count = 0

for email in stud_metrics['email'].unique():
    try:
        strategy = recommender.generate_learning_strategy(
            email, stud_metrics, course_features, course_data
        )
        
        # Check if error
        if 'error' in strategy and strategy['error']:
            print(f"\nSkipping {email}: {strategy['error']}")
            error_count += 1
            continue
        
        success_count += 1

        print(f"\n{'='*70}")
        print(f"👤 Student: {strategy['student_name']} ({strategy['email']})")
        print(f"{'='*70}")

        print(f"\nCurrent Course:")
        print(f"  - {strategy['current_course']}")

        print(f"\nCurrent Status:")
        print(f"  - Completion Rate: {strategy['completion_rate']:.1f}%")
        print(f"  - Exam Score: {strategy['exam_score']:.0f}/100")
        print(f"  - Submission Rating: {strategy['submission_rating']:.1f}/5")
        print(f"  - Success Probability: {strategy['success_probability']*100:.1f}%")
        print(f"  - Overall Status: {strategy['adaptive_roadmap']['current_status']['overall_status']}")

        print(f"\nRecommended Next Courses:")
        if strategy['recommended_courses']:
            for i, course_rec in enumerate(strategy['recommended_courses'], 1):
                duration = f" ({course_rec['hours_to_study']}h)" if course_rec['hours_to_study'] != 'N/A' else ""
                print(f"  {i}. {course_rec['name']} ({course_rec['course_difficulty']}) - Duration{duration}")
        else:
            print("  Tidak ada rekomendasi")

        print(f"\nLearning Roadmap:")
        for i, step in enumerate(strategy['adaptive_roadmap']['next_steps'], 1):
            print(f"  {i}. {step}")

        print(f"\nEstimated Completion: {strategy['adaptive_roadmap']['estimated_completion']}")

        if strategy['adaptive_roadmap']['insights']:
            print(f"\nKey Insights:")
            for insight in strategy['adaptive_roadmap']['insights']:
                print(f"  - {insight}")
    
    except Exception as e:
        print(f"\nError processing {email}: {e}")
        error_count += 1
        import traceback
        traceback.print_exc()

print("\n" + "="*80)
print(f"   - Success: {success_count} students")
print(f"   - Errors: {error_count} students")
print("="*80)