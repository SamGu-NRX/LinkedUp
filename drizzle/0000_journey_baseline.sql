-- Production was created with drizzle-kit push before migration tracking existed.
-- Adopt matching tables, preserve their rows, and reject incompatible definitions
-- before the migration journal can mark the baseline applied.
DO $baseline$
DECLARE
  definition record;
  expected_table regclass;
  actual_table regclass;
  mismatch text;
BEGIN
  FOR definition IN SELECT * FROM (VALUES
    ('connections', $table$(
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
)$table$),
    ('interests', $table$(
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"icon_name" varchar(50),
	"custom_id" varchar(100)
)$table$),
    ('meetings', $table$(
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"scheduled_at" timestamp,
	"is_random" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
)$table$),
    ('messages', $table$(
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
)$table$),
    ('queue_entries', $table$(
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"queue_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"room_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exited_at" timestamp with time zone
)$table$),
    ('rooms', $table$(
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"user1_id" integer NOT NULL,
	"user2_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
)$table$),
    ('users', $table$(
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(255),
	"last_name" varchar(255),
	"age" integer,
	"gender" varchar(20),
	"field" varchar(100),
	"job_title" varchar(100),
	"company" varchar(100),
	"linkedin_url" varchar(255),
	"bio" text,
	"onboarding_complete" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
)$table$)
  ) AS tables(name, columns_sql) LOOP
    EXECUTE format('CREATE TEMP TABLE %I %s', '_linkedup_expected_' || definition.name, definition.columns_sql);
    expected_table := to_regclass('pg_temp.' || '_linkedup_expected_' || definition.name);
    actual_table := to_regclass(format('%I.%I', current_schema(), definition.name));
    IF actual_table IS NULL THEN
      EXECUTE format('CREATE TABLE %I %s', definition.name, definition.columns_sql);
      actual_table := to_regclass(format('%I.%I', current_schema(), definition.name));
    ELSIF definition.name = 'users' THEN
      -- Main predates the persisted names used by onboarding on alpha.
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" varchar(255);
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" varchar(255);
    END IF;

    SELECT string_agg(e.attname, ', ' ORDER BY e.attnum) INTO mismatch
    FROM pg_attribute e
    LEFT JOIN pg_attribute a ON a.attrelid = actual_table AND a.attname = e.attname AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ed ON ed.adrelid = e.attrelid AND ed.adnum = e.attnum
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE e.attrelid = expected_table AND e.attnum > 0 AND NOT e.attisdropped
      AND (a.attname IS NULL OR a.atttypid <> e.atttypid OR a.atttypmod <> e.atttypmod
        OR a.attnotnull <> e.attnotnull
        OR regexp_replace(pg_get_expr(ad.adbin, ad.adrelid), 'nextval\(''[^'']+''::regclass\)', 'serial')
           IS DISTINCT FROM regexp_replace(pg_get_expr(ed.adbin, ed.adrelid), 'nextval\(''[^'']+''::regclass\)', 'serial'));
    IF mismatch IS NOT NULL THEN
      RAISE EXCEPTION 'LinkedUp baseline mismatch: %.% (type, nullability, or default differs)', definition.name, mismatch;
    END IF;

    -- An unknown required column without a generated value prevents the
    -- application's inserts, even when every baseline column matches.
    SELECT string_agg(a.attname, ', ' ORDER BY a.attnum) INTO mismatch
    FROM pg_attribute a
    LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
    WHERE a.attrelid = actual_table AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attnotnull AND a.attgenerated = '' AND a.attidentity = ''
      AND ad.oid IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_attribute e
        WHERE e.attrelid = expected_table AND e.attname = a.attname AND NOT e.attisdropped);
    IF mismatch IS NOT NULL THEN
      RAISE EXCEPTION 'LinkedUp baseline mismatch: %.% (unexpected required column without a default)', definition.name, mismatch;
    END IF;

    SELECT string_agg(pg_get_constraintdef(e.oid), ', ') INTO mismatch
    FROM pg_constraint e
    WHERE e.conrelid = expected_table AND e.contype IN ('p', 'u')
      AND NOT EXISTS (SELECT 1 FROM pg_constraint a WHERE a.conrelid = actual_table
        AND a.contype = e.contype AND pg_get_constraintdef(a.oid) = pg_get_constraintdef(e.oid));
    IF mismatch IS NOT NULL THEN
      RAISE EXCEPTION 'LinkedUp baseline mismatch: % requires %', definition.name, mismatch;
    END IF;
    EXECUTE format('DROP TABLE %s', expected_table);
  END LOOP;
END $baseline$;
--> statement-breakpoint
DO $foreign_keys$
DECLARE
  definition record;
  actual_definition text;
BEGIN
  FOR definition IN SELECT * FROM (VALUES
    ('interests', 'interests_user_id_users_id_fk', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'),
    ('queue_entries', 'queue_entries_user_id_users_id_fk', 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE'),
    ('queue_entries', 'queue_entries_room_id_rooms_id_fk', 'FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL'),
    ('rooms', 'rooms_user1_id_users_id_fk', 'FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE'),
    ('rooms', 'rooms_user2_id_users_id_fk', 'FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE')
  ) AS constraints(table_name, name, ddl) LOOP
    SELECT pg_get_constraintdef(oid) INTO actual_definition FROM pg_constraint
    WHERE conrelid = to_regclass(format('%I.%I', current_schema(), definition.table_name)) AND conname = definition.name;
    IF actual_definition IS NULL THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', definition.table_name, definition.name, definition.ddl);
    ELSIF actual_definition <> definition.ddl THEN
      RAISE EXCEPTION 'LinkedUp baseline mismatch: % expected %, found %', definition.name, definition.ddl, actual_definition;
    END IF;
  END LOOP;
END $foreign_keys$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "queue_entries_user_waiting_unique" ON "queue_entries" USING btree ("user_id") WHERE status = 'waiting';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "queue_entries_pairing_idx" ON "queue_entries" USING btree ("queue_type","status");
--> statement-breakpoint
DO $indexes$
DECLARE
  definition record;
BEGIN
  -- Compare the index method, columns and predicate with PostgreSQL's own
  -- normalized definition, so an existing index name cannot hide a mismatch.
  CREATE TEMP TABLE _linkedup_expected_queue (user_id integer, queue_type varchar(20), status varchar(20));
  CREATE UNIQUE INDEX _linkedup_expected_waiting ON _linkedup_expected_queue USING btree (user_id) WHERE status = 'waiting';
  CREATE INDEX _linkedup_expected_pairing ON _linkedup_expected_queue USING btree (queue_type, status);
  FOR definition IN SELECT * FROM (VALUES
    ('queue_entries_user_waiting_unique', '_linkedup_expected_waiting'),
    ('queue_entries_pairing_idx', '_linkedup_expected_pairing')
  ) AS indexes(name, expected_name) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_index a, pg_index e
      WHERE a.indexrelid = to_regclass(format('%I.%I', current_schema(), definition.name))
        AND a.indrelid = 'queue_entries'::regclass
        AND e.indexrelid = to_regclass('pg_temp.' || definition.expected_name)
        AND a.indisunique = e.indisunique AND a.indisvalid
        AND split_part(pg_get_indexdef(a.indexrelid), ' USING ', 2) = split_part(pg_get_indexdef(e.indexrelid), ' USING ', 2)
    ) THEN
      RAISE EXCEPTION 'LinkedUp baseline mismatch: index %', definition.name;
    END IF;
  END LOOP;
  DROP TABLE _linkedup_expected_queue;
END $indexes$;
