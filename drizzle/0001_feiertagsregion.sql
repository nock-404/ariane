-- Aus dem Bundesland wird eine Feiertagsregion: sie kann auch ein anderes
-- Land sein. Bestandswerte sind alle deutsche Kürzel und bekommen "DE-".
ALTER TABLE "person" RENAME COLUMN "bundesland" TO "region";
--> statement-breakpoint
ALTER TABLE "person" ALTER COLUMN "region" SET DEFAULT '';
--> statement-breakpoint
UPDATE "person" SET "region" = 'DE-' || "region"
  WHERE "region" <> '' AND "region" NOT LIKE 'DE-%';
--> statement-breakpoint
UPDATE "setting" SET "key" = 'defaultRegion',
                     "value" = CASE WHEN "value" LIKE 'DE-%' THEN "value" ELSE 'DE-' || "value" END
  WHERE "key" = 'defaultBundesland';
