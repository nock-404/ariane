CREATE TABLE "absence" (
	"person_id" uuid NOT NULL,
	"week" date NOT NULL,
	"days" numeric(3, 1) NOT NULL,
	CONSTRAINT "absence_person_id_week_pk" PRIMARY KEY("person_id","week")
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"person_id" uuid NOT NULL,
	"subproject_id" uuid NOT NULL,
	"week" date NOT NULL,
	"hours" numeric(5, 2) NOT NULL,
	CONSTRAINT "assignment_person_id_subproject_id_week_pk" PRIMARY KEY("person_id","subproject_id","week")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"initials" text DEFAULT '' NOT NULL,
	"bundesland" text DEFAULT 'NW' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_capacity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"valid_from" date NOT NULL,
	"net_hours" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subproject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_on" date,
	"ends_on" date,
	"open_ended" boolean DEFAULT false NOT NULL,
	"budget_hours" numeric(8, 1),
	"actual_hours" numeric(8, 1),
	"actual_as_of" date,
	"sort" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "team_slot" (
	"person_id" uuid NOT NULL,
	"subproject_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_slot_person_id_subproject_id_pk" PRIMARY KEY("person_id","subproject_id")
);
--> statement-breakpoint
ALTER TABLE "absence" ADD CONSTRAINT "absence_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_subproject_id_subproject_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subproject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_capacity" ADD CONSTRAINT "person_capacity_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subproject" ADD CONSTRAINT "subproject_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_slot" ADD CONSTRAINT "team_slot_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_slot" ADD CONSTRAINT "team_slot_subproject_id_subproject_id_fk" FOREIGN KEY ("subproject_id") REFERENCES "public"."subproject"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_week_idx" ON "assignment" USING btree ("week");--> statement-breakpoint
CREATE INDEX "assignment_sub_idx" ON "assignment" USING btree ("subproject_id");--> statement-breakpoint
CREATE INDEX "person_capacity_person_idx" ON "person_capacity" USING btree ("person_id","valid_from");--> statement-breakpoint
CREATE INDEX "subproject_project_idx" ON "subproject" USING btree ("project_id","sort");