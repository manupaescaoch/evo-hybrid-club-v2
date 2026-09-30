-- Create a generic trigger function for tables that use 'updated_at' column
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Re-bind the food/foods triggers to the correct function
DROP TRIGGER IF EXISTS foods_updated_at ON public.foods;
CREATE TRIGGER foods_updated_at
BEFORE UPDATE ON public.foods
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS food_measures_updated_at ON public.food_measures;
CREATE TRIGGER food_measures_updated_at
BEFORE UPDATE ON public.food_measures
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();