import sys
sys.path.append('backend')

import pandas as pd
from backend.services.data_loader import load_excel_as_records

# Load course data
course = pd.DataFrame(load_excel_as_records("LP and Course Mapping.xlsx", "Course"))

print("\nCheck course_level_str data type:")
print(f"Data type: {course['course_level_str'].dtype}")
print(f"\nSample values (raw):")
for idx in range(min(5, len(course))):
    val = course.iloc[idx]['course_level_str']
    print(f"  Index {idx}: {repr(val)} (type: {type(val).__name__})")

print("\nCheck unique values:")
unique_levels = course['course_level_str'].unique()
print(f"Unique levels: {unique_levels}")
for level in unique_levels:
    print(f"  - {repr(level)} (type: {type(level).__name__})")

print("\nTest specific courses:")
test_courses = ['Memulai Pemrograman dengan Kotlin', 
                'Belajar Membuat Aplikasi Android untuk Pemula',
                'Belajar Prinsip Pemrograman SOLID']

for course_name in test_courses:
    match = course[course['course_name'] == course_name]
    if not match.empty:
        level = match.iloc[0]['course_level_str']
        print(f"\n'{course_name}':")
        print(f"  Level raw: {repr(level)}")
        print(f"  Type: {type(level).__name__}")
        print(f"  After str(): {repr(str(level))}")
        print(f"  After strip(): {repr(str(level).strip())}")

print("\nTest mapping:")
level_map = {
    1: "Dasar",
    2: "Pemula",
    3: "Menengah",
    4: "Mahir",
    5: "Profesional",
    "1": "Dasar",
    "2": "Pemula",
    "3": "Menengah",
    "4": "Mahir",
    "5": "Profesional"
}

for course_name in test_courses:
    match = course[course['course_name'] == course_name]
    if not match.empty:
        level = match.iloc[0]['course_level_str']
        level_str = str(level).strip()
        try:
            level_int = int(level_str)
        except:
            level_int = None
        
        result = level_map.get(level_str) or level_map.get(level_int) or "N/A"
        
        print(f"\n'{course_name[:40]}':")
        print(f"  Raw: {repr(level)}")
        print(f"  Str: {repr(level_str)}")
        print(f"  Int: {level_int}")
        print(f"  Mapped: {result}")

print("\nDebug Complete!")