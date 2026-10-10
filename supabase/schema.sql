-- ============================================================
-- Claude Todo · Supabase 数据表
-- 用法：Supabase 控制台 → SQL Editor → 粘贴执行本文件
-- ============================================================

create table if not exists public.tasks (
  id           uuid primary key,                -- 客户端生成的 uuid
  owner        text not null,                   -- 访客标识（无登录方案），由请求头 x-owner-id 传入
  text         text not null default '',
  done         boolean not null default false,
  priority     int not null default 0,          -- 0 无 / 1 高 / 2 中 / 3 低
  due          date,
  starred      boolean not null default false,
  tags         text[] not null default '{}',
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

-- 开启行级安全：每个访客只能读写自己的行（owner 与请求头 x-owner-id 匹配）
alter table public.tasks enable row level security;

drop policy if exists "tasks scoped to owner header" on public.tasks;
create policy "tasks scoped to owner header"
  on public.tasks
  for all
  using (owner = current_setting('request.headers', true)::json ->> 'x-owner-id')
  with check (owner = current_setting('request.headers', true)::json ->> 'x-owner-id');

-- 建议索引
create index if not exists tasks_owner_idx on public.tasks (owner);
