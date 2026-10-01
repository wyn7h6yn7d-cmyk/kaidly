import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ConfigurationError, getSupabaseEnv } from "../../lib/env.ts";

const saved = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

function setEnv(url: string | undefined, key: string | undefined) {
  if (url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = url;
  if (key === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
}

afterEach(() => setEnv(saved.url, saved.key));

test("returns the configuration when it is complete", () => {
  setEnv("https://abcdefghijklmnopqrst.supabase.co", "sb_publishable_test");
  assert.deepEqual(getSupabaseEnv(), {
    url: "https://abcdefghijklmnopqrst.supabase.co",
    publishableKey: "sb_publishable_test",
  });
});

test("allows the local Supabase stack over http", () => {
  setEnv("http://127.0.0.1:54321", "sb_publishable_local");
  assert.equal(getSupabaseEnv().url, "http://127.0.0.1:54321");
});

test("fails closed when values are missing", () => {
  setEnv(undefined, undefined);
  assert.throws(() => getSupabaseEnv(), ConfigurationError);
  setEnv("https://abcdefghijklmnopqrst.supabase.co", "");
  assert.throws(() => getSupabaseEnv(), /PUBLISHABLE_KEY is not set/);
});

test("fails closed on the .env.example placeholders", () => {
  setEnv("your-project-url", "your-publishable-or-anon-key");
  assert.throws(() => getSupabaseEnv(), ConfigurationError);
});

test("rejects a URL with an API path or without https", () => {
  setEnv("https://abcdefghijklmnopqrst.supabase.co/rest/v1/", "k");
  assert.throws(() => getSupabaseEnv(), /without a path/);
  setEnv("http://abcdefghijklmnopqrst.supabase.co", "k");
  assert.throws(() => getSupabaseEnv(), /https/);
});

test("the error names the missing variables but never echoes values", () => {
  setEnv("https://abcdefghijklmnopqrst.supabase.co/rest/v1", undefined);
  assert.throws(
    () => getSupabaseEnv(),
    (error: Error) =>
      error.message.includes("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") &&
      !error.message.includes("abcdefghijklmnopqrst"),
  );
});
