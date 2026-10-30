#!/usr/bin/env python3
"""HTTP integration smoke test for PHP login, CSRF, sessions and JSON API.
Requires accounting_smoke.php database state and a running php -S on port 8013.
"""
import json
import re
import urllib.error
import urllib.request
import http.cookiejar

BASE = "http://127.0.0.1:8013/"
cookies = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))

def request(path, body=None, csrf=None):
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    headers = {"Accept":"application/json"}
    if raw is not None:
        headers["Content-Type"] = "application/json"
        if csrf is not None: headers["X-CSRF-Token"] = csrf
    r = urllib.request.Request(BASE + path, raw, headers)
    try:
        with opener.open(r, timeout=12) as response:
            payload=response.read()
            return response.status, payload.decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")

status,html = request("index.php")
assert status==200 and "login-form" in html, "Login page not served"
csrf_match=re.search(r"window\.NS_BOOT\s*=\s*(\{.*?\});",html)
assert csrf_match is not None, "Session bootstrap token missing"
csrf=json.loads(csrf_match.group(1))["csrf"]
print("PASS: HTML login form and CSRF token")

status,output=request("api.php?op=bootstrap")
assert status==401, (status,output[:400])
print("PASS: unauthenticated API rejected")

status,output=request("api.php?op=login",{"email":"smoke@example.com","password":"test-password-for-smoke"})
assert status==419, (status,output[:400])
print("PASS: POST without CSRF rejected")

status,output=request("api.php?op=login",{"email":"smoke@example.com","password":"test-password-for-smoke"},csrf)
assert status==200, (status,output[:800])
login=json.loads(output)
assert login["ok"] and login["user"]["role"]=="admin"
csrf=login["csrf"]
print("PASS: admin login")

status,html=request("index.php")
assert status==200 and 'id="app"' in html, "Authenticated shell missing"
print("PASS: authenticated app shell")

status,output=request("api.php?op=bootstrap")
data=json.loads(output)
assert status==200 and data["ok"] and len(data["data"]["accounts"])>=10 and data["data"]["branches"]
cash_account=next(a["id"] for a in data["data"]["accounts"] if a["code"]=="101")
print("PASS: bootstrap data and chart of accounts")

status,output=request("api.php?op=dashboard")
data=json.loads(output)
assert status==200 and data["ok"] and "totals" in data["data"] and "stock" in data["data"]
print("PASS: dashboard JSON")

status,output=request("api.php?op=report&type=trial")
data=json.loads(output)
assert status==200 and data["ok"] and len(data["data"])>=10
assert abs(sum(float(row["debit"])-float(row["credit"]) for row in data["data"]))<.01
print("PASS: balanced trial balance from HTTP API")

status,output=request("api.php?op=list&type=sales")
data=json.loads(output)
assert status==200 and data["ok"] and len(data["data"])>=2
print("PASS: sales listing")

status,output=request("api.php?op=save_party",{"kind":"customers","name":"عميل HTTP","phone":"733123456","address":"Yemen"},csrf)
data=json.loads(output)
assert status==200 and data["ok"] and data["data"]["id"]>2
print("PASS: CSRF-protected customer creation")

# Regression: a posted account cannot be reclassified, because doing so silently
# restates historical profit/loss and the balance sheet.
status,output=request("api.php?op=save_account",{"code":"699","name":"مصروف فحص التصنيف","type":"expense"},csrf)
assert status==200, (status,output[:400])
account_id=json.loads(output)["data"]["id"]
status,output=request("api.php?op=post_journal",{
    "date":"2026-10-29","branch_id":1,"description":"Classification integrity regression",
    "lines":[{"account_id":account_id,"debit":4,"credit":0},
             {"account_id":cash_account,"debit":0,"credit":4}]
},csrf)
assert status==200, (status,output[:400])
status,output=request("api.php?op=save_account",{
    "id":account_id,"code":"699","name":"مصروف فحص التصنيف","type":"revenue"
},csrf)
assert status==409, (status,output[:400])
print("PASS: posted account classification is immutable")
status,output=request("api.php?op=save_account",{
    "id":account_id,"code":"699","name":"مصروف فحص التصنيف - معدّل","type":"expense"
},csrf)
assert status==200, (status,output[:400])
print("PASS: account description remains editable")

status,output=request("api.php?op=logout",{},csrf)
assert status==200 and json.loads(output)["ok"]
status,output=request("api.php?op=bootstrap")
assert status==401
print("PASS: logout invalidates session")
print("ALL HTTP SMOKE TESTS PASSED")
