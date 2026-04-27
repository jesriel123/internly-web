-- ============================================================
-- Internly - Company-Scoped RLS Hardening
-- Purpose:
-- 1) Super Admin can access all rows.
-- 2) Admin can access only rows tied to their own company.
-- 3) Keep self-access for regular users where needed.
--
-- Run in Supabase SQL Editor (as project owner/service role).
-- Safe to re-run.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper identity functions (SECURITY DEFINER to avoid recursion)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user')
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_company()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(company, '')
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_user_role() = 'super_admin';
$$;

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_company() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_company() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ------------------------------------------------------------
-- Notifications helper functions (recreated for consistency)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_notification_recipient(_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notification_logs nl
    WHERE nl.notification_id = _notification_id
      AND nl.recipient_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_notification_sender(_notification_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.id = _notification_id
      AND n.sender_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_notification_recipient(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_notification_sender(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_notification_recipient(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_notification_sender(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Harden RPC used by web/mobile to insert notification logs
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification_logs(
  _notification_id UUID,
  _recipient_ids UUID[],
  _default_status TEXT DEFAULT 'sent'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role TEXT;
  _company TEXT;
  _inserted_count INTEGER := 0;
BEGIN
  _role := public.get_user_role();
  _company := public.get_user_company();

  IF _role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Only admins can create notification logs';
  END IF;

  IF _notification_id IS NULL THEN
    RAISE EXCEPTION 'notification_id is required';
  END IF;

  IF COALESCE(array_length(_recipient_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.id = _notification_id
      AND n.sender_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only create logs for notifications you sent';
  END IF;

  IF _role = 'admin' THEN
    INSERT INTO public.notification_logs (notification_id, recipient_id, status)
    SELECT
      _notification_id,
      dedup.recipient_id,
      COALESCE(NULLIF(_default_status, ''), 'sent')
    FROM (
      SELECT DISTINCT UNNEST(_recipient_ids) AS recipient_id
    ) dedup
    INNER JOIN public.users u ON u.id = dedup.recipient_id
    WHERE COALESCE(u.company, '') = _company;
  ELSE
    INSERT INTO public.notification_logs (notification_id, recipient_id, status)
    SELECT
      _notification_id,
      dedup.recipient_id,
      COALESCE(NULLIF(_default_status, ''), 'sent')
    FROM (
      SELECT DISTINCT UNNEST(_recipient_ids) AS recipient_id
    ) dedup
    INNER JOIN public.users u ON u.id = dedup.recipient_id;
  END IF;

  GET DIAGNOSTICS _inserted_count = ROW_COUNT;
  RETURN _inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification_logs(UUID, UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_notification_logs(UUID, UUID[], TEXT) TO authenticated;

-- ------------------------------------------------------------
-- Utility: drop all policies on a table (idempotent reset)
-- ------------------------------------------------------------
DO $$
DECLARE
  _tbl TEXT;
  _pol RECORD;
BEGIN
  FOREACH _tbl IN ARRAY ARRAY[
    'users', 'time_logs', 'companies', 'settings', 'audit_logs',
    'device_tokens', 'notifications', 'notification_logs'
  ]
  LOOP
    IF to_regclass('public.' || _tbl) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', _tbl);
      FOR _pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = _tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', _pol.policyname, _tbl);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- users policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY users_select_self ON public.users
    FOR SELECT USING (id = auth.uid());

  CREATE POLICY users_select_super_admin ON public.users
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY users_select_admin_company ON public.users
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND COALESCE(company, '') = public.get_user_company()
    );

  CREATE POLICY users_insert_self ON public.users
    FOR INSERT WITH CHECK (id = auth.uid());

  CREATE POLICY users_update_self ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

  CREATE POLICY users_update_super_admin ON public.users
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

  CREATE POLICY users_update_admin_company ON public.users
    FOR UPDATE
    USING (
      public.get_user_role() = 'admin'
      AND COALESCE(company, '') = public.get_user_company()
      AND COALESCE(role, 'user') <> 'super_admin'
    )
    WITH CHECK (
      public.get_user_role() = 'admin'
      AND COALESCE(company, '') = public.get_user_company()
      AND COALESCE(role, 'user') <> 'super_admin'
    );

  CREATE POLICY users_delete_super_admin ON public.users
    FOR DELETE USING (public.is_super_admin());
END $$;

-- ------------------------------------------------------------
-- time_logs policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.time_logs') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY logs_select_own ON public.time_logs
    FOR SELECT USING (user_id = auth.uid());

  CREATE POLICY logs_select_super_admin ON public.time_logs
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY logs_select_admin_company ON public.time_logs
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = time_logs.user_id
          AND COALESCE(u.company, '') = public.get_user_company()
      )
    );

  CREATE POLICY logs_insert_own ON public.time_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

  CREATE POLICY logs_update_own_pending ON public.time_logs
    FOR UPDATE
    USING (user_id = auth.uid() AND status = 'pending')
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY logs_update_super_admin ON public.time_logs
    FOR UPDATE
    USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());

  CREATE POLICY logs_update_admin_company ON public.time_logs
    FOR UPDATE
    USING (
      public.get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = time_logs.user_id
          AND COALESCE(u.company, '') = public.get_user_company()
      )
    )
    WITH CHECK (
      public.get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = time_logs.user_id
          AND COALESCE(u.company, '') = public.get_user_company()
      )
    );

  CREATE POLICY logs_delete_super_admin ON public.time_logs
    FOR DELETE USING (public.is_super_admin());
END $$;

-- ------------------------------------------------------------
-- companies policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.companies') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY companies_select_super_admin ON public.companies
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY companies_select_admin_company ON public.companies
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND name = public.get_user_company()
    );

  CREATE POLICY companies_select_user ON public.companies
    FOR SELECT USING (public.get_user_role() = 'user');

  CREATE POLICY companies_write_super_admin ON public.companies
    FOR ALL USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
END $$;

-- ------------------------------------------------------------
-- settings policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.settings') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY settings_select_authenticated ON public.settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

  CREATE POLICY settings_update_super_admin ON public.settings
    FOR UPDATE USING (public.is_super_admin())
    WITH CHECK (public.is_super_admin());
END $$;

-- ------------------------------------------------------------
-- audit_logs policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY audit_select_super_admin ON public.audit_logs
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY audit_select_admin_company ON public.audit_logs
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = audit_logs.user_id
            AND COALESCE(u.company, '') = public.get_user_company()
        )
      )
    );

  CREATE POLICY audit_insert_authenticated ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
END $$;

-- ------------------------------------------------------------
-- device_tokens policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.device_tokens') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY device_tokens_select_own ON public.device_tokens
    FOR SELECT USING (user_id = auth.uid());

  CREATE POLICY device_tokens_select_super_admin ON public.device_tokens
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY device_tokens_select_admin_company ON public.device_tokens
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = device_tokens.user_id
          AND COALESCE(u.company, '') = public.get_user_company()
      )
    );

  CREATE POLICY device_tokens_insert_own ON public.device_tokens
    FOR INSERT WITH CHECK (user_id = auth.uid());

  CREATE POLICY device_tokens_update_own ON public.device_tokens
    FOR UPDATE USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

  CREATE POLICY device_tokens_delete_own ON public.device_tokens
    FOR DELETE USING (user_id = auth.uid());
END $$;

-- ------------------------------------------------------------
-- notifications policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY notifications_select_sender ON public.notifications
    FOR SELECT USING (sender_id = auth.uid());

  CREATE POLICY notifications_select_super_admin ON public.notifications
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY notifications_select_recipient ON public.notifications
    FOR SELECT USING (public.is_notification_recipient(id));

  CREATE POLICY notifications_select_admin_company_target ON public.notifications
    FOR SELECT USING (
      public.get_user_role() = 'admin'
      AND COALESCE(target_company, '') = public.get_user_company()
    );

  CREATE POLICY notifications_insert_super_admin ON public.notifications
    FOR INSERT WITH CHECK (
      public.is_super_admin()
      AND sender_id = auth.uid()
    );

  CREATE POLICY notifications_insert_admin_company ON public.notifications
    FOR INSERT WITH CHECK (
      public.get_user_role() = 'admin'
      AND sender_id = auth.uid()
      AND COALESCE(target_company, '') = public.get_user_company()
      AND COALESCE(is_global, false) = false
    );
END $$;

-- ------------------------------------------------------------
-- notification_logs policies
-- ------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.notification_logs') IS NULL THEN
    RETURN;
  END IF;

  CREATE POLICY notification_logs_select_own ON public.notification_logs
    FOR SELECT USING (recipient_id = auth.uid());

  CREATE POLICY notification_logs_select_super_admin ON public.notification_logs
    FOR SELECT USING (public.is_super_admin());

  CREATE POLICY notification_logs_select_sender ON public.notification_logs
    FOR SELECT USING (public.is_notification_sender(notification_id));

  CREATE POLICY notification_logs_insert_super_admin ON public.notification_logs
    FOR INSERT WITH CHECK (
      public.is_super_admin()
      AND public.is_notification_sender(notification_id)
    );

  CREATE POLICY notification_logs_insert_admin_company ON public.notification_logs
    FOR INSERT WITH CHECK (
      public.get_user_role() = 'admin'
      AND public.is_notification_sender(notification_id)
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = notification_logs.recipient_id
          AND COALESCE(u.company, '') = public.get_user_company()
      )
    );

  CREATE POLICY notification_logs_update_read_own ON public.notification_logs
    FOR UPDATE
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());
END $$;

COMMIT;
