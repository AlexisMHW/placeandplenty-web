. /home/claude/pp-work/EXEC/e3-verify/web/e2e_verify/env.sh
DB=${1:-e_run}
psql -h /tmp -p $PGPORT -U postgres -X -q -d postgres -c "do \$\$ begin if not exists (select 1 from pg_roles where rolname='authenticator') then create role authenticator noinherit login; end if; end \$\$; grant anon, authenticated, service_role to authenticator;"
pkill -f e3_pgrst.conf 2>/dev/null; sleep 0.5
cat > /tmp/e3_pgrst.conf <<CONF
db-uri = "postgres://authenticator@/$DB?host=/tmp&port=$PGPORT"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$(cat /tmp/e3_jwt_secret)"
server-host = "127.0.0.1"
server-port = 54494
db-pool = 5
log-level = "warn"
CONF
chmod 600 /tmp/e3_pgrst.conf
nohup /tmp/e2dl/postgrest /tmp/e3_pgrst.conf > /tmp/e3_pgrst.log 2>&1 &
sleep 2; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54494/; tail -3 /tmp/e3_pgrst.log
