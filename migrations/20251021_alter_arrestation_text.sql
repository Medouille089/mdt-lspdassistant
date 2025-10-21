-- Migration : Change motifarrestation and circonstances to TEXT
ALTER TABLE lspd_arrestations ALTER COLUMN motifarrestation TYPE text;
ALTER TABLE lspd_arrestations ALTER COLUMN circonstances TYPE text;
