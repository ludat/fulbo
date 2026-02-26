CREATE POLICY group_members_delete ON group_members FOR DELETE TO app_user USING (is_group_admin(group_id) AND (user_id <> current_user_id()));

GRANT DELETE ON TABLE group_members TO app_user;
