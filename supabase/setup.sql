-- =====================================================================
-- 새벽빛 우리집 · Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여넣고 Run
--
-- ★ 맨 아래 한 줄의 '여기에-모임-코드' 를 우리 모임 코드로 바꾸세요.
--   (나중에 코드를 바꿀 때도 그 줄만 다시 실행하면 돼요)
-- =====================================================================

-- 표 만들기 -------------------------------------------------------------
create table if not exists chapel_config (
  id int primary key default 1 check (id = 1),
  code text not null
);

create table if not exists chapel_prayers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 20),
  text text not null check (char_length(text) between 1 and 500),
  amen text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists chapel_attendance (
  day date not null,
  name text not null check (char_length(name) between 1 and 20),
  primary key (day, name)
);

-- 표를 직접 읽거나 쓰지 못하게 잠금 (정책 없음)
-- → 아래 함수로만, 그리고 모임 코드가 맞을 때만 사용할 수 있어요
alter table chapel_config enable row level security;
alter table chapel_prayers enable row level security;
alter table chapel_attendance enable row level security;

-- 함수 -----------------------------------------------------------------
create or replace function chapel_check(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_code is null or not exists (select 1 from chapel_config where code = p_code) then
    raise exception 'invalid group code' using errcode = '28000';
  end if;
end $$;

create or replace function chapel_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Seoul')::date $$;

-- 기도제목 목록 (최신 200개)
create or replace function chapel_prayer_list(p_code text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  return coalesce((
    select json_agg(json_build_object(
      'id', p.id, 'name', p.name, 'text', p.text, 'amen', p.amen,
      'date', to_char(p.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD')
    ) order by p.created_at desc)
    from (select * from chapel_prayers order by created_at desc limit 200) p
  ), '[]'::json);
end $$;

create or replace function chapel_add_prayer(p_code text, p_name text, p_text text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  insert into chapel_prayers (name, text) values (left(trim(p_name), 20), left(trim(p_text), 500));
  return chapel_prayer_list(p_code);
end $$;

create or replace function chapel_amen(p_code text, p_id uuid, p_name text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  update chapel_prayers set amen = array_append(amen, left(trim(p_name), 20))
    where id = p_id and not (left(trim(p_name), 20) = any(amen));
  return chapel_prayer_list(p_code);
end $$;

-- 본인이 쓴 기도제목만 삭제
create or replace function chapel_delete_prayer(p_code text, p_id uuid, p_name text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  delete from chapel_prayers where id = p_id and name = p_name;
  return chapel_prayer_list(p_code);
end $$;

-- 오늘 함께 기도한 사람
create or replace function chapel_attendance_list(p_code text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  return coalesce((select json_agg(name order by name) from chapel_attendance where day = chapel_today()), '[]'::json);
end $$;

create or replace function chapel_attend(p_code text, p_name text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform chapel_check(p_code);
  insert into chapel_attendance (day, name) values (chapel_today(), left(trim(p_name), 20))
    on conflict do nothing;
  delete from chapel_attendance where day < chapel_today() - 60; -- 60일 지난 기록은 정리
  return chapel_attendance_list(p_code);
end $$;

-- 웹사이트(anon)에서는 위 함수만 부를 수 있게
revoke all on function chapel_check(text), chapel_prayer_list(text), chapel_add_prayer(text, text, text),
  chapel_amen(text, uuid, text), chapel_delete_prayer(text, uuid, text),
  chapel_attendance_list(text), chapel_attend(text, text) from public;
grant execute on function chapel_prayer_list(text), chapel_add_prayer(text, text, text),
  chapel_amen(text, uuid, text), chapel_delete_prayer(text, uuid, text),
  chapel_attendance_list(text), chapel_attend(text, text) to anon, authenticated;

-- ★ 모임 코드 설정 (따옴표 안을 바꾸세요) ------------------------------
insert into chapel_config (id, code) values (1, '여기에-모임-코드')
  on conflict (id) do update set code = excluded.code;
