do $$ declare r record; pk text; res text; c bigint; m text;
begin
 create temp table if not exists _res(t text, n bigint, m text);
 truncate _res;
 for r in select c.relname t from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('r','p') order by 1 loop
  select string_agg(quote_ident(a.attname),',' order by k.ord) into pk from pg_index i cross join lateral unnest(i.indkey) with ordinality k(attnum,ord) join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum where i.indrelid=('public.'||quote_ident(r.t))::regclass and i.indisprimary;
  execute format('select count(*), md5(coalesce(string_agg(to_jsonb(t)::text, E''\n'' order by %s collate "C"),'''')) from public.%I t', coalesce('('||pk||')::text', 'to_jsonb(t)::text'), r.t) into c, m;
  insert into _res values(r.t,c,m);
 end loop;
end $$;
select t||E'\t'||n||E'\t'||m from _res order by t;
