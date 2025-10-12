ALTER TABLE configlspd ADD COLUMN logs_bracelets VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_arrestations VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_incidents VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_convocations VARCHAR;
ALTER TABLE configlspd ADD COLUMN logs_convocations_agent VARCHAR;

UPDATE configlspd SET logs_bracelets = '1426743899011154021';
UPDATE configlspd SET logs_arrestations = '1426743945756545024';
UPDATE configlspd SET logs_incidents = '1426744014304182293';
UPDATE configlspd SET logs_convocations = '1426744031391780874';
UPDATE configlspd SET logs_convocations_agent = '1426744075247292446';