CREATE TABLE public.sales (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status text NOT NULL DEFAULT 'CONFIRMADA'
        CHECK (status IN ('CONFIRMADA', 'ANULADA', 'PARCIALMENTE_DEVUELTA', 'DEVUELTA')),
    sale_type text NOT NULL CHECK (sale_type IN ('MAYORISTA', 'MINORISTA')),
    sold_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    total_amount numeric(16, 2) NOT NULL CHECK (total_amount >= 0),
    total_cost numeric(16, 2) NOT NULL CHECK (total_cost >= 0),
    gross_margin numeric(16, 2) GENERATED ALWAYS AS (total_amount - total_cost) STORED,
    notes text CHECK (char_length(notes) <= 300),
    cancellation_reason text CHECK (char_length(cancellation_reason) <= 200),
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    cancelled_by uuid REFERENCES public.profiles(id),
    cancelled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sales_cancellation_state CHECK (
        (status = 'ANULADA' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL
            AND cancellation_reason IS NOT NULL AND btrim(cancellation_reason) <> '')
        OR (status <> 'ANULADA' AND cancelled_by IS NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL)
    )
);

CREATE TABLE public.sale_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id bigint NOT NULL REFERENCES public.sales(id),
    product_id bigint NOT NULL REFERENCES public.products(id),
    cost_source text NOT NULL CHECK (cost_source = 'MANUAL'),
    quantity integer NOT NULL CHECK (quantity > 0),
    unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost numeric(12, 2) NOT NULL CHECK (unit_cost >= 0),
    line_total numeric(16, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    line_cost numeric(16, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
    line_margin numeric(16, 2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED,
    UNIQUE (sale_id, product_id),
    UNIQUE (id, product_id)
);

CREATE TABLE public.sale_returns (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_id bigint NOT NULL REFERENCES public.sales(id),
    returned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    reason text NOT NULL CHECK (btrim(reason) <> '' AND char_length(reason) <= 200),
    created_by uuid NOT NULL REFERENCES public.profiles(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_return_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sale_return_id bigint NOT NULL REFERENCES public.sale_returns(id),
    sale_item_id bigint NOT NULL REFERENCES public.sale_items(id),
    quantity integer NOT NULL CHECK (quantity > 0),
    UNIQUE (sale_return_id, sale_item_id),
    UNIQUE (id, sale_item_id)
);

CREATE INDEX sales_history_idx ON public.sales (sold_at DESC, id DESC);
CREATE INDEX sales_created_by_idx ON public.sales (created_by);
CREATE INDEX sales_cancelled_by_idx ON public.sales (cancelled_by);
CREATE INDEX sale_items_product_id_idx ON public.sale_items (product_id);
CREATE INDEX sale_returns_sale_id_idx ON public.sale_returns (sale_id);
CREATE INDEX sale_returns_created_by_idx ON public.sale_returns (created_by);
CREATE INDEX sale_return_items_sale_item_id_idx ON public.sale_return_items (sale_item_id);

ALTER TABLE public.stock_movements
    ADD COLUMN sale_item_id bigint,
    ADD COLUMN sale_return_item_id bigint,
    ADD CONSTRAINT stock_movements_sale_item_fk
        FOREIGN KEY (sale_item_id, product_id) REFERENCES public.sale_items(id, product_id),
    ADD CONSTRAINT stock_movements_return_item_fk
        FOREIGN KEY (sale_return_item_id, sale_item_id) REFERENCES public.sale_return_items(id, sale_item_id),
    DROP CONSTRAINT stock_movements_type_and_sign,
    DROP CONSTRAINT stock_movements_adjustment_reason,
    ADD CONSTRAINT stock_movements_type_and_sign CHECK (
        (movement_type IN ('PRODUCCION', 'AJUSTE_POSITIVO') AND quantity_delta > 0
            AND sale_item_id IS NULL AND sale_return_item_id IS NULL)
        OR (movement_type = 'AJUSTE_NEGATIVO' AND quantity_delta < 0
            AND sale_item_id IS NULL AND sale_return_item_id IS NULL)
        OR (movement_type = 'VENTA' AND quantity_delta < 0
            AND sale_item_id IS NOT NULL AND sale_return_item_id IS NULL)
        OR (movement_type = 'ANULACION' AND quantity_delta > 0
            AND sale_item_id IS NOT NULL AND sale_return_item_id IS NULL)
        OR (movement_type = 'DEVOLUCION' AND quantity_delta > 0
            AND sale_item_id IS NOT NULL AND sale_return_item_id IS NOT NULL)
    ),
    ADD CONSTRAINT stock_movements_adjustment_reason CHECK (
        movement_type IN ('PRODUCCION', 'VENTA') OR (reason IS NOT NULL AND btrim(reason) <> '')
    );

CREATE UNIQUE INDEX stock_movements_sale_once_idx
    ON public.stock_movements (sale_item_id, movement_type)
    WHERE movement_type IN ('VENTA', 'ANULACION');
CREATE INDEX stock_movements_sale_item_id_idx ON public.stock_movements (sale_item_id);
CREATE UNIQUE INDEX stock_movements_return_once_idx
    ON public.stock_movements (sale_return_item_id) WHERE sale_return_item_id IS NOT NULL;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sales, public.sale_items, public.sale_returns, public.sale_return_items
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.sales_id_seq, public.sale_items_id_seq,
    public.sale_returns_id_seq, public.sale_return_items_id_seq FROM PUBLIC, anon, authenticated;
