import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Format singulier pour les commandes CLI (migrate deploy, db push)
  datasource: {
    url: process.env["DATABASE_URL"] || "",
  },
  // Format pluriel pour spécifier le provider (utilisé par prisma generate)
  datasources: {
    db: {
      url: process.env["DATABASE_URL"] || "",
      provider: "postgresql",
    },
  },
});
