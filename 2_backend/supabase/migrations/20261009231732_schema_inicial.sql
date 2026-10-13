-- Base inicial para PostgreSQL en Supabase.
-- Migración inicial gestionada por Supabase CLI.
-- auth.users ya existe en Supabase y no se crea en este script.

CREATE TABLE public.roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE CHECK (code = upper(code)),
    name text NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id),
    role_id bigint NOT NULL REFERENCES public.roles(id),
    display_name text NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_categories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id bigint NOT NULL REFERENCES public.product_categories(id),
    sku text UNIQUE,
    name text NOT NULL,
    description text,
    image_path text,
    reference_sale_price numeric(12, 2) NOT NULL DEFAULT 0
        CHECK (reference_sale_price >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- La FK profiles.id ya tiene el índice de su clave primaria.
CREATE INDEX profiles_role_id_idx ON public.profiles(role_id);
CREATE INDEX products_category_id_idx ON public.products(category_id);
CREATE INDEX products_created_by_idx ON public.products(created_by);

INSERT INTO public.roles (code, name, description)
VALUES ('ADMINISTRADOR', 'Administrador', 'Acceso administrativo al sistema.');

-- Las políticas de acceso se agregarán al implementar la autenticación.
-- Por ahora no se habilita el acceso de clientes mediante la API.
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.roles, public.profiles,
    public.product_categories, public.products FROM anon, authenticated;

