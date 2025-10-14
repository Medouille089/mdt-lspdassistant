ALTER TABLE configlspd ADD COLUMN blacklist_role_id VARCHAR;

UPDATE configlspd SET blacklist_role_id = '1128821739145674762';