. /home/claude/pp-work/EXEC/e-verify/scripts/env.sh
rm -rf $PGD; mkdir -p $PGD; chown postgres $PGD
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $PGD -U postgres -A trust -E UTF8 >/dev/null"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $PGD -o '-p $PGPORT -k /tmp -c listen_addresses= -c fsync=off -c synchronous_commit=off' -l /tmp/e_pg.log start >/dev/null"
sleep 2; psql -h /tmp -p $PGPORT -U postgres -d postgres -c 'select version()' | head -3
