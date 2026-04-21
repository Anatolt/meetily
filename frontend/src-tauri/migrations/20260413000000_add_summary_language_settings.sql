-- Add summary output language preferences to summary model settings.
ALTER TABLE settings ADD COLUMN summaryLanguageMode TEXT;
ALTER TABLE settings ADD COLUMN summaryLanguageValue TEXT;
