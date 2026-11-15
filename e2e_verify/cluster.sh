. /home/claude/pp-work/EXEC/e3-verify/web/e2e_verify/env.sh
rm -rf $PGD; mkdir -p $PGD; chown postgres $PGD
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGD -U postgres -A trust -E UTF8 >/dev/null"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGD -o '-p $PGPORT -k /tmp -c listen_addresses= -c fsync=off -c synchronous_commit=off -c timezone=UTC' -l /tmp/e3_pg.log start >/dev/null"
sleep 2; psql -h /tmp -p $PGPORT -U postgres -d postgres -c 'select version()' | head -3
psql -X -q -h /tmp -p $PGPORT -U postgres -d postgres -c "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role supabase_auth_admin nologin;"
