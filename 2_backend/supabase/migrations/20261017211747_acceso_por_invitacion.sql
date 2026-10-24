-- La identidad y las credenciales siguen siendo propiedad de Supabase Auth.
-- Registrar quién concedió acceso; NULL permite el primer administrador manual.
ALTER TABLE public.profiles
    ADD COLUMN invited_by uuid REFERENCES public.profiles(id);

CREATE INDEX profiles_invited_by_idx ON public.profiles(invited_by);
