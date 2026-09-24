-- A lightweight event log for the agent's self-improvement loop.
--
-- "Gets better every day" is only a real claim if it can be measured. Every
-- caught violation and every applied fix is recorded here with the rule and
-- the day, so an operator can see the violation rate per rule trending down
-- over time rather than taking it on faith.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agent_events" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"severity" text NOT NULL,
	-- "violation" when the scan caught a breach, "fix" when a lesson was
	-- recorded for it. The ratio of fixes to violations per rule per day is
	-- the improvement signal.
	"kind" text NOT NULL,
	"detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_events_rule_idx" ON "agent_events" ("rule_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_events_created_idx" ON "agent_events" ("created_at");
