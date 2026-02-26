REVOKE DELETE, INSERT, MAINTAIN, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON TABLE group_members FROM app_user;

GRANT UPDATE (role) ON TABLE group_members TO app_user;

CREATE POLICY group_members_update ON group_members FOR UPDATE TO app_user USING (is_group_admin(group_id)) WITH CHECK (is_group_admin(group_id));
