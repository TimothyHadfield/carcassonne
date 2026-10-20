// Tiny test harness: no framework, just counts.
let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) pass++;
  else { fail++; console.log('  FAIL: ' + msg); }
}
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ' (got ' + a + ', want ' + b + ')'); }
function done(name) {
  console.log(name + ': ' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
}
module.exports = { ok, eq, near, done };
