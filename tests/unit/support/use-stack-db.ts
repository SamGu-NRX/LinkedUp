// Import first in any unit test that touches Postgres, before "@/db":
// ES modules evaluate in import order, so DATABASE_URL is pinned to the
// stack's database (and the server checked) before the db client is built.
import { assertStackCluster, stackDatabaseUrl } from "../../stack-db";

process.env.DATABASE_URL = stackDatabaseUrl();
await assertStackCluster(process.env.DATABASE_URL);
