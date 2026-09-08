// Kate's Taro Shop — Supabase 접속 정보
//
// index.html 과 confirm.html 이 같이 쓴다. 한 곳에만 적어 두려고 파일을 나눴다.
// 여기 있는 anon key 는 공개돼도 되는 값이다. 이 키만으로는 남의 기록을 못 본다.
// 막는 것은 키가 아니라 DB의 RLS 정책(auth.uid() = user_id)이다.
// Claude API 키는 여기 없다. 그건 Edge Function 환경변수에만 있다.

const SUPABASE_URL = "https://hwihutjovqonuvajfhar.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aWh1dGpvdnFvbnV2YWpmaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzIyMTQsImV4cCI6MjEwNDQwODIxNH0.r_KZVs59dqa7le8jqgJ5aTqbGoiLjKQsQo4S-FsmzHA";
