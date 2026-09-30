UPDATE public.physical_assessments
SET body_fat_percentage = 19.96,
    lean_mass_percentage = 80.04,
    fat_mass_kg = ROUND((weight * 19.96 / 100)::numeric, 2),
    lean_mass_kg = ROUND((weight - (weight * 19.96 / 100))::numeric, 2),
    skinfold_sum = 145
WHERE id = '13031475-5a70-4f72-bc8e-813ad605306e';