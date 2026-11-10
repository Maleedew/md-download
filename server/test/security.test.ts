import test from "node:test";
import assert from "node:assert/strict";
import { assertPublicHost, isPrivateAddress, parseUrl } from "../src/security.js";
import { UserError } from "../src/errors.js";

test("parseUrl accepts normal links and adds https:// when missing", () => {
  assert.equal(parseUrl("https://www.youtube.com/watch?v=abc").hostname, "www.youtube.com");
  assert.equal(parseUrl("  youtu.be/abc  ").protocol, "https:");
  assert.equal(parseUrl("vm.tiktok.com/ZM123/").hostname, "vm.tiktok.com");
});

test("parseUrl rejects junk, other schemes and embedded credentials", () => {
  for (const bad of ["", "   ", "hello", "file:///etc/passwd", "ftp://x.com/a", "javascript:alert(1)",
    "https://user:pw@example.com/v", "http://localhost", "x".repeat(3000)]) {
    assert.throws(() => parseUrl(bad), UserError, bad.slice(0, 30));
  }
  assert.throws(() => parseUrl(42 as unknown), UserError);
});

test("private / internal addresses are recognised", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.80.46", "2606:4700:4700::1111", "172.32.0.1"]) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test("assertPublicHost blocks IP literals and local names without needing DNS", async () => {
  for (const u of ["http://127.0.0.1/x", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://10.0.0.5:8080/",
    "http://localhost.localdomain.local/", "http://foo.internal/"]) {
    await assert.rejects(assertPublicHost(new URL(u)), UserError, u);
  }
  await assert.doesNotReject(assertPublicHost(new URL("http://8.8.8.8/")));
});
