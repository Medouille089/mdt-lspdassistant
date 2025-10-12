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

-- Fake data pour l'utilisateur 1358197546111205466 sur 4 semaines
DO $$
DECLARE
    base_date DATE := CURRENT_DATE - EXTRACT(DOW FROM CURRENT_DATE)::INT; -- début semaine courante (dimanche)
    i INT;
    j INT;
BEGIN
    FOR i IN 0..3 LOOP -- 0 = semaine courante, 1-3 = précédentes
        FOR j IN 0..6 LOOP -- chaque jour de la semaine
            INSERT INTO lspd_pointage (
                id_discord,
                discord_role_id,
                start_time,
                end_time,
                salary_earned
            ) VALUES (
                '1358197546111205466',
                '1096965866324770857',
                (base_date - (i * 7) + j)::timestamp + interval '9 hours',
                (base_date - (i * 7) + j)::timestamp + interval '17 hours',
                100.00
            );
        END LOOP;
    END LOOP;
END $$;