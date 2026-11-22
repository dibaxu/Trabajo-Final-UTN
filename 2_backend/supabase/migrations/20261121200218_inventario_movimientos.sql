CREATE TABLE public.stock_movements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    product_id bigint NOT NULL REFERENCES public.products(id),
    movement_type text NOT NULL,
    quantity_delta integer NOT NULL,
    reason text,
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT stock_movements_type_and_sign CHECK (
        (movement_type IN ('PRODUCCION', 'AJUSTE_POSITIVO') AND quantity_delta > 0)
        OR (movement_type = 'AJUSTE_NEGATIVO' AND quantity_delta < 0)
    ),
    CONSTRAINT stock_movements_reason_length CHECK (char_length(reason) <= 200),
    CONSTRAINT stock_movements_adjustment_reason CHECK (
        movement_type = 'PRODUCCION' OR (reason IS NOT NULL AND btrim(reason) <> '')
    )
);

CREATE INDEX stock_movements_product_history_idx
    ON public.stock_movements (product_id, occurred_at DESC, id DESC);
CREATE INDEX stock_movements_history_idx
    ON public.stock_movements (occurred_at DESC, id DESC);
CREATE INDEX stock_movements_created_by_idx ON public.stock_movements (created_by);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stock_movements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.stock_movements_id_seq FROM PUBLIC, anon, authenticated;
