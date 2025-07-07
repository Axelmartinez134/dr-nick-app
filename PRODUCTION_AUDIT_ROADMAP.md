# 📋 PRODUCTION AUDIT ROADMAP
*8-Day Testing Framework for Dr. Nick's Health Tracker*

## **🔧 What Are Testing Scripts?**
Testing scripts are small programs that automatically simulate user actions:
- **Example**: A script that creates 5 test patients and has them all submit forms simultaneously
- **Benefit**: Tests scenarios you can't easily do manually (like 20 people logging in at once)
- **Simple**: I'll create these as basic JavaScript files you can run

---

## **📊 GOOGLE SHEETS FRAMEWORK STRUCTURE**

### **Sheet 1: "Master Control Matrix"**
| Day | Phase | Test Category | Priority | Status | Notes | Owner |
|-----|-------|---------------|----------|---------|-------|--------|

### **Sheet 2: "Critical Reliability Tests"**
| Test ID | Test Name | Test Type | Pass/Fail | Error Details | Retest Required | Date Completed |
|---------|-----------|-----------|-----------|---------------|-----------------|----------------|

### **Sheet 3: "Daily Progress Tracker"**
| Day | Planned Tests | Completed Tests | Critical Issues Found | Resolution Status | Next Day Action |
|-----|---------------|-----------------|----------------------|-------------------|-----------------|

---

## **🎯 8-DAY PRODUCTION AUDIT ROADMAP**

### **DAY 1: Core System Reliability Audit**
*"Can the basic system function?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D1-01 | Dr. Nick Login Test | Manual | Successfully logs in, sees dashboard | YES |
| D1-02 | Patient Login Test | Manual | Successfully logs in, sees dashboard | YES |
| D1-03 | Patient Form Submission | Manual | Form submits, data saves to database | YES |
| D1-04 | Dr. Nick Can See Submissions | Manual | Submissions appear in queue | YES |
| D1-05 | Photo Upload Test | Manual | 14 photos upload successfully | YES |
| D1-06 | Dr. Nick Can View Photos | Manual | All 14 photos display correctly | YES |

**Day 1 Success Criteria**: All 6 tests pass ✅

---

### **DAY 2: Data Integrity & Persistence**
*"Does data save correctly and stay saved?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D2-01 | Data Persistence Test | Manual | Submit data, logout, login - data still there | YES |
| D2-02 | Multi-Patient Data Isolation | Manual | Patient A cannot see Patient B's data | YES |
| D2-03 | Form Validation Test | Manual | Invalid data rejected with clear errors | YES |
| D2-04 | Database Backup Verification | Manual | Confirm Supabase backups are running | YES |
| D2-05 | Dr. Nick Data Modification | Manual | Dr. Nick can edit patient data successfully | YES |
| D2-06 | Week Progression Logic | Manual | Smart week calculation works correctly | YES |

**Day 2 Success Criteria**: All 6 tests pass ✅

---

### **DAY 3: Authentication & Security**
*"Can users access what they should and not access what they shouldn't?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D3-01 | Invalid Login Rejection | Manual | Wrong passwords rejected | YES |
| D3-02 | Role-Based Access Control | Manual | Patients can't access Dr. Nick features | YES |
| D3-03 | Session Management | Manual | Sessions expire appropriately | YES |
| D3-04 | Direct URL Access Block | Manual | Unauthorized direct URLs blocked | YES |
| D3-05 | Password Reset Flow | Manual | Password reset works if needed | NO |
| D3-06 | Account Creation Process | Manual | Dr. Nick can create new patients | YES |

**Day 3 Success Criteria**: All critical tests pass ✅

---

### **DAY 4: File Storage & Image Management**
*"Do photos upload, store, and display correctly?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D4-01 | Large File Upload Test | Manual | 10MB photos upload successfully | YES |
| D4-02 | Multiple File Upload Test | Manual | All 14 photos upload in sequence | YES |
| D4-03 | File Storage Organization | Manual | Files organized by patient/week/day | YES |
| D4-04 | Image Display Test | Manual | All uploaded images display correctly | YES |
| D4-05 | PDF Upload Test | Manual | Whoop PDFs upload successfully | YES |
| D4-06 | Storage Space Monitoring | Manual | Check current storage usage | NO |

**Day 4 Success Criteria**: All critical tests pass ✅

---

### **DAY 5: Queue & Review System**
*"Can Dr. Nick process patient submissions efficiently?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D5-01 | Submission Queue Display | Manual | New submissions appear in queue | YES |
| D5-02 | Queue Processing Flow | Manual | Can review and mark submissions complete | YES |
| D5-03 | Analysis Entry System | Manual | Can add weekly/monthly analysis | YES |
| D5-04 | Queue Status Updates | Manual | Queue status updates correctly | YES |
| D5-05 | Multi-Patient Queue | Manual | Multiple patients in queue display correctly | YES |
| D5-06 | Review Completion Flow | Manual | Completed reviews leave queue | YES |

**Day 5 Success Criteria**: All 6 tests pass ✅

---

### **DAY 6: Charts & Analytics**
*"Do progress charts display patient data correctly?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D6-01 | Weight Loss Metrics | Manual | Total weight loss % calculates correctly | YES |
| D6-02 | Weekly Progress Charts | Manual | Charts display with correct data | YES |
| D6-03 | Historical Data Display | Manual | All historical data shows in charts | YES |
| D6-04 | Chart Performance | Manual | Charts load within reasonable time | NO |
| D6-05 | Multi-Week Data Display | Manual | Charts show progression across weeks | YES |
| D6-06 | Dr. Nick Chart Access | Manual | Dr. Nick can view any patient's charts | YES |

**Day 6 Success Criteria**: All critical tests pass ✅

---

### **DAY 7: Load Testing & Scripts**
*"Can the system handle multiple users?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D7-01 | Multi-User Login Script | Script | 5 users can login simultaneously | YES |
| D7-02 | Concurrent Submission Script | Script | 3 patients can submit forms simultaneously | YES |
| D7-03 | Photo Upload Load Test | Script | Multiple photo uploads don't crash system | YES |
| D7-04 | Database Connection Test | Script | Database handles concurrent connections | YES |
| D7-05 | Monday Morning Simulation | Script | Simulate 10 patients Monday morning rush | YES |
| D7-06 | System Recovery Test | Manual | System recovers from high load | NO |

**Day 7 Success Criteria**: All critical tests pass ✅

---

### **DAY 8: Final Production Readiness**
*"Is the system ready for 20 real patients?"*

| Test ID | Test Name | Test Type | Expected Result | Critical? |
|---------|-----------|-----------|-----------------|-----------|
| D8-01 | End-to-End Patient Flow | Manual | Complete patient journey works | YES |
| D8-02 | End-to-End Dr. Nick Flow | Manual | Complete doctor workflow works | YES |
| D8-03 | Error Recovery Test | Manual | System handles errors gracefully | YES |
| D8-04 | Production Environment Check | Manual | Live environment configured correctly | YES |
| D8-05 | Emergency Contact Procedures | Manual | Know who to contact if system fails | YES |
| D8-06 | Go-Live Readiness Sign-off | Manual | All critical systems functioning | YES |

**Day 8 Success Criteria**: All 6 tests pass ✅ **READY FOR PRODUCTION**

---

## **🔧 TESTING SCRIPTS I'll CREATE**

### **Script 1: Multi-User Login Test**
```javascript
// Tests 5 users logging in simultaneously
// Reports any failures or timeouts
```

### **Script 2: Concurrent Form Submission**
```javascript
// Tests multiple patients submitting forms at once
// Verifies all data saves correctly
```

### **Script 3: Photo Upload Load Test**
```javascript
// Tests multiple photo uploads
// Identifies any upload failures
```

### **Script 4: Monday Morning Simulation**
```javascript
// Simulates 10 patients all submitting at 8 AM
// Tests the worst-case scenario
```

---

## **📊 GOOGLE SHEETS COLUMNS YOU'LL NEED**

### **Master Control Matrix Columns:**
- **Day**: 1-8
- **Phase**: Setup/Test/Verify
- **Test Category**: Auth/Data/Files/Queue/Charts
- **Priority**: Critical/Important/Nice-to-Have
- **Status**: Not Started/In Progress/Complete/Failed
- **Notes**: Detailed observations
- **Owner**: Who's doing the test

### **Critical Reliability Tests Columns:**
- **Test ID**: D1-01, D1-02, etc.
- **Test Name**: Descriptive name
- **Test Type**: Manual/Script
- **Pass/Fail**: Simple pass/fail
- **Error Details**: What went wrong
- **Retest Required**: Yes/No
- **Date Completed**: When finished

### **Daily Progress Tracker Columns:**
- **Day**: 1-8
- **Planned Tests**: How many planned
- **Completed Tests**: How many finished
- **Critical Issues Found**: Number of critical failures
- **Resolution Status**: Fixed/Pending/Blocked
- **Next Day Action**: What to do tomorrow

---

## **🚨 CRITICAL FAILURE SCENARIOS TO TEST**

Based on your concerns, these are the **MUST-PASS** scenarios:

1. **Client can't submit data** → Tests D1-03, D2-01, D4-02
2. **Client can't see data** → Tests D2-01, D6-02, D6-03
3. **Client can't login** → Tests D1-02, D3-01, D3-02
4. **Nick can't see submissions** → Tests D1-04, D5-01, D5-02
5. **Nick can't modify customer data** → Tests D2-05, D5-03

**If ANY of these fail, STOP and fix before proceeding.**

---

## **📋 RELIABILITY FOCUS AREAS**

### **Priority 1: Data Flow Integrity**
- Patient submits → Data saves → Dr. Nick sees it
- Dr. Nick modifies → Changes persist → Patient sees updates
- No data loss, no corruption, no missing submissions

### **Priority 2: Authentication Reliability**
- Login always works for valid credentials
- Sessions don't expire unexpectedly
- Role-based access never fails

### **Priority 3: File Upload Reliability**
- Photos always upload completely
- No partial uploads or corruption
- All uploaded files accessible

### **Priority 4: System Recovery**
- Graceful handling of errors
- Clear error messages for users
- System doesn't crash from user actions

---

## **🎯 SUCCESS METRICS**

### **Go-Live Readiness Criteria:**
- ✅ All 42 critical tests pass
- ✅ No data loss scenarios identified
- ✅ All user workflows function end-to-end
- ✅ System handles expected load without failures
- ✅ Error recovery procedures documented

### **Performance Tolerance:**
- ⏱️ 3-5 second load times acceptable
- ⏱️ Photo uploads may take 30-60 seconds
- ⏱️ Chart rendering may take 2-3 seconds
- 🚨 Complete failures are NOT acceptable

---

*This roadmap prioritizes reliability over performance, focusing on ensuring the system functions correctly for 20 patients rather than optimizing for speed.* 




Query 1: Table Structures
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY table_schema, table_name;

Query 2 Json result 
[
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "schema_migrations",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "sso_domains",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "sso_providers",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "auth",
    "table_name": "users",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "extensions",
    "table_name": "pg_stat_statements",
    "table_type": "VIEW"
  },
  {
    "table_schema": "extensions",
    "table_name": "pg_stat_statements_info",
    "table_type": "VIEW"
  },
  {
    "table_schema": "public",
    "table_name": "health_data",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "public",
    "table_name": "profiles",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "realtime",
    "table_name": "messages",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "realtime",
    "table_name": "schema_migrations",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "realtime",
    "table_name": "subscription",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "storage",
    "table_name": "buckets",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "storage",
    "table_name": "migrations",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "storage",
    "table_name": "objects",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "table_type": "BASE TABLE"
  },
  {
    "table_schema": "vault",
    "table_name": "decrypted_secrets",
    "table_type": "VIEW"
  },
  {
    "table_schema": "vault",
    "table_name": "secrets",
    "table_type": "BASE TABLE"
  }
]



Query 2: All Columns
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY table_schema, table_name, ordinal_position;


Query 2 Json Result 



[
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "instance_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "payload",
    "data_type": "json",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "ip_address",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": "''::character varying"
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "auth_code",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "code_challenge_method",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "code_challenge",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "provider_type",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "provider_access_token",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "provider_refresh_token",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "authentication_method",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "auth_code_issued_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "provider_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "identity_data",
    "data_type": "jsonb",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "provider",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "last_sign_in_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "email",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": "gen_random_uuid()"
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "uuid",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "raw_base_config",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "session_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "authentication_method",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "factor_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "verified_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "ip_address",
    "data_type": "inet",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "otp_code",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "web_authn_session_data",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "friendly_name",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "factor_type",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "status",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "secret",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "phone",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "last_challenged_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "web_authn_credential",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "web_authn_aaguid",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "token_type",
    "data_type": "USER-DEFINED",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "token_hash",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "relates_to",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "created_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "updated_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "NO",
    "column_default": "now()"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "instance_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "id",
    "data_type": "bigint",
    "is_nullable": "NO",
    "column_default": "nextval('auth.refresh_tokens_id_seq'::regclass)"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "token",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "user_id",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "revoked",
    "data_type": "boolean",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "parent",
    "data_type": "character varying",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "session_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "sso_provider_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "entity_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "metadata_xml",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "metadata_url",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "attribute_mapping",
    "data_type": "jsonb",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "name_id_format",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "sso_provider_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "request_id",
    "data_type": "text",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "for_email",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "redirect_to",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "flow_state_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "schema_migrations",
    "column_name": "version",
    "data_type": "character varying",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "user_id",
    "data_type": "uuid",
    "is_nullable": "NO",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "updated_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "factor_id",
    "data_type": "uuid",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "aal",
    "data_type": "USER-DEFINED",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "not_after",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "refreshed_at",
    "data_type": "timestamp without time zone",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "user_agent",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "ip",
    "data_type": "inet",
    "is_nullable": "YES",
    "column_default": null
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "tag",
    "data_type": "text",
    "is_nullable": "YES",
    "column_default": null
  }
]




Query 3: Constraints (Primary Keys, Foreign Keys)
SELECT 
    tc.table_schema,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY tc.table_name, tc.constraint_type;

Query 3 result

[
  {
    "table_schema": "auth",
    "table_name": "audit_log_entries",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "audit_log_entries_pkey"
  },
  {
    "table_schema": "storage",
    "table_name": "buckets",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "buckets_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "flow_state",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "flow_state_pkey"
  },
  {
    "table_schema": "public",
    "table_name": "health_data",
    "column_name": "user_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "fk_health_data_profiles"
  },
  {
    "table_schema": "public",
    "table_name": "health_data",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "health_data_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "user_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "identities_user_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "identities_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "provider",
    "constraint_type": "UNIQUE",
    "constraint_name": "identities_provider_id_provider_unique"
  },
  {
    "table_schema": "auth",
    "table_name": "identities",
    "column_name": "provider_id",
    "constraint_type": "UNIQUE",
    "constraint_name": "identities_provider_id_provider_unique"
  },
  {
    "table_schema": "auth",
    "table_name": "instances",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "instances_pkey"
  },
  {
    "table_schema": "realtime",
    "table_name": "messages",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "messages_pkey"
  },
  {
    "table_schema": "realtime",
    "table_name": "messages",
    "column_name": "inserted_at",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "messages_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "session_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "mfa_amr_claims_session_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "amr_id_pk"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "session_id",
    "constraint_type": "UNIQUE",
    "constraint_name": "mfa_amr_claims_session_id_authentication_method_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_amr_claims",
    "column_name": "authentication_method",
    "constraint_type": "UNIQUE",
    "constraint_name": "mfa_amr_claims_session_id_authentication_method_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "factor_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "mfa_challenges_auth_factor_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_challenges",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "mfa_challenges_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "user_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "mfa_factors_user_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "mfa_factors_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "mfa_factors",
    "column_name": "last_challenged_at",
    "constraint_type": "UNIQUE",
    "constraint_name": "mfa_factors_last_challenged_at_key"
  },
  {
    "table_schema": "storage",
    "table_name": "objects",
    "column_name": "bucket_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "objects_bucketId_fkey"
  },
  {
    "table_schema": "storage",
    "table_name": "objects",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "objects_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "user_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "one_time_tokens_user_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "one_time_tokens",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "one_time_tokens_pkey"
  },
  {
    "table_schema": "public",
    "table_name": "profiles",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "profiles_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "session_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "refresh_tokens_session_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "refresh_tokens_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "refresh_tokens",
    "column_name": "token",
    "constraint_type": "UNIQUE",
    "constraint_name": "refresh_tokens_token_unique"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "bucket_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "s3_multipart_uploads_bucket_id_fkey"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "s3_multipart_uploads_pkey"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "upload_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "s3_multipart_uploads_parts_upload_id_fkey"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "bucket_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "s3_multipart_uploads_parts_bucket_id_fkey"
  },
  {
    "table_schema": "storage",
    "table_name": "s3_multipart_uploads_parts",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "s3_multipart_uploads_parts_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "sso_provider_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "saml_providers_sso_provider_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "saml_providers_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_providers",
    "column_name": "entity_id",
    "constraint_type": "UNIQUE",
    "constraint_name": "saml_providers_entity_id_key"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "sso_provider_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "saml_relay_states_sso_provider_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "flow_state_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "saml_relay_states_flow_state_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "saml_relay_states",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "saml_relay_states_pkey"
  },
  {
    "table_schema": "realtime",
    "table_name": "schema_migrations",
    "column_name": "version",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "schema_migrations_pkey"
  },
  {
    "table_schema": "realtime",
    "table_name": "schema_migrations",
    "column_name": "version",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "schema_migrations_pkey"
  },
  {
    "table_schema": "vault",
    "table_name": "secrets",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "secrets_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "user_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "sessions_user_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "sessions",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "sessions_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "sso_domains",
    "column_name": "sso_provider_id",
    "constraint_type": "FOREIGN KEY",
    "constraint_name": "sso_domains_sso_provider_id_fkey"
  },
  {
    "table_schema": "auth",
    "table_name": "sso_domains",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "sso_domains_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "sso_providers",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "sso_providers_pkey"
  },
  {
    "table_schema": "realtime",
    "table_name": "subscription",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "pk_subscription"
  },
  {
    "table_schema": "auth",
    "table_name": "users",
    "column_name": "id",
    "constraint_type": "PRIMARY KEY",
    "constraint_name": "users_pkey"
  },
  {
    "table_schema": "auth",
    "table_name": "users",
    "column_name": "phone",
    "constraint_type": "UNIQUE",
    "constraint_name": "users_phone_key"
  }
]



Query 4: Row Level Security Policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


Query 4 result:
[
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Dr Nick can create health data",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.email() = 'thefittesttribe@gmail.com'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Dr Nick can insert profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.email() = 'thefittesttribe@gmail.com'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Dr Nick can update health data",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "UPDATE",
    "qual": "(auth.email() = 'thefittesttribe@gmail.com'::text)",
    "with_check": "(auth.email() = 'thefittesttribe@gmail.com'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Dr Nick can view all health data",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.email() = 'thefittesttribe@gmail.com'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Users can delete own health metrics",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "DELETE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Users can insert own health metrics",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.uid() = user_id)"
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Users can update own health metrics",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "UPDATE",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "health_data",
    "policyname": "Users can view own health metrics",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.uid() = user_id)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Dr Nick can create profiles",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "INSERT",
    "qual": null,
    "with_check": "(auth.email() = 'thefittesttribe@gmail.com'::text)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Dr Nick can view all profiles",
    "permissive": "PERMISSIVE",
    "roles": "{authenticated}",
    "cmd": "SELECT",
    "qual": "(auth.email() = 'thefittesttribe@gmail.com'::text)",
    "with_check": null
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "policyname": "Users can view own profile",
    "permissive": "PERMISSIVE",
    "roles": "{public}",
    "cmd": "SELECT",
    "qual": "((auth.uid() = id) OR (auth.email() = 'thefittesttribe@gmail.com'::text))",
    "with_check": null
  }
]








Query 5: All Indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

Query 5 result:
[
  {
    "schemaname": "public",
    "tablename": "health_data",
    "indexname": "health_data_pkey",
    "indexdef": "CREATE UNIQUE INDEX health_data_pkey ON public.health_data USING btree (id)"
  },
  {
    "schemaname": "public",
    "tablename": "profiles",
    "indexname": "profiles_pkey",
    "indexdef": "CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)"
  }
]




Query 6: Functions and Stored Procedures
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    CASE p.prokind
        WHEN 'f' THEN 'FUNCTION'
        WHEN 'p' THEN 'PROCEDURE'
        WHEN 'a' THEN 'AGGREGATE'
        WHEN 'w' THEN 'WINDOW'
    END as function_type
FROM pg_catalog.pg_proc p
LEFT JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY schema_name, function_name;



Query 6 result:
[
  {
    "schema_name": "auth",
    "function_name": "email",
    "return_type": "text",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "auth",
    "function_name": "jwt",
    "return_type": "jsonb",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "auth",
    "function_name": "role",
    "return_type": "text",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "auth",
    "function_name": "uid",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "armor",
    "return_type": "text",
    "arguments": "bytea, text[], text[]",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "armor",
    "return_type": "text",
    "arguments": "bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "crypt",
    "return_type": "text",
    "arguments": "text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "dearmor",
    "return_type": "bytea",
    "arguments": "text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "decrypt",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "decrypt_iv",
    "return_type": "bytea",
    "arguments": "bytea, bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "digest",
    "return_type": "bytea",
    "arguments": "bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "digest",
    "return_type": "bytea",
    "arguments": "text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "encrypt",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "encrypt_iv",
    "return_type": "bytea",
    "arguments": "bytea, bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "gen_random_bytes",
    "return_type": "bytea",
    "arguments": "integer",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "gen_random_uuid",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "gen_salt",
    "return_type": "text",
    "arguments": "text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "gen_salt",
    "return_type": "text",
    "arguments": "text, integer",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "grant_pg_cron_access",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "grant_pg_graphql_access",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "grant_pg_net_access",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "hmac",
    "return_type": "bytea",
    "arguments": "text, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "hmac",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pg_stat_statements",
    "return_type": "SETOF record",
    "arguments": "showtext boolean, OUT userid oid, OUT dbid oid, OUT toplevel boolean, OUT queryid bigint, OUT query text, OUT plans bigint, OUT total_plan_time double precision, OUT min_plan_time double precision, OUT max_plan_time double precision, OUT mean_plan_time double precision, OUT stddev_plan_time double precision, OUT calls bigint, OUT total_exec_time double precision, OUT min_exec_time double precision, OUT max_exec_time double precision, OUT mean_exec_time double precision, OUT stddev_exec_time double precision, OUT rows bigint, OUT shared_blks_hit bigint, OUT shared_blks_read bigint, OUT shared_blks_dirtied bigint, OUT shared_blks_written bigint, OUT local_blks_hit bigint, OUT local_blks_read bigint, OUT local_blks_dirtied bigint, OUT local_blks_written bigint, OUT temp_blks_read bigint, OUT temp_blks_written bigint, OUT shared_blk_read_time double precision, OUT shared_blk_write_time double precision, OUT local_blk_read_time double precision, OUT local_blk_write_time double precision, OUT temp_blk_read_time double precision, OUT temp_blk_write_time double precision, OUT wal_records bigint, OUT wal_fpi bigint, OUT wal_bytes numeric, OUT jit_functions bigint, OUT jit_generation_time double precision, OUT jit_inlining_count bigint, OUT jit_inlining_time double precision, OUT jit_optimization_count bigint, OUT jit_optimization_time double precision, OUT jit_emission_count bigint, OUT jit_emission_time double precision, OUT jit_deform_count bigint, OUT jit_deform_time double precision, OUT stats_since timestamp with time zone, OUT minmax_stats_since timestamp with time zone",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pg_stat_statements_info",
    "return_type": "record",
    "arguments": "OUT dealloc bigint, OUT stats_reset timestamp with time zone",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pg_stat_statements_reset",
    "return_type": "timestamp with time zone",
    "arguments": "userid oid DEFAULT 0, dbid oid DEFAULT 0, queryid bigint DEFAULT 0, minmax_only boolean DEFAULT false",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_armor_headers",
    "return_type": "SETOF record",
    "arguments": "text, OUT key text, OUT value text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_key_id",
    "return_type": "text",
    "arguments": "bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt",
    "return_type": "text",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt",
    "return_type": "text",
    "arguments": "bytea, bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt",
    "return_type": "text",
    "arguments": "bytea, bytea, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_decrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_encrypt",
    "return_type": "bytea",
    "arguments": "text, bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_encrypt",
    "return_type": "bytea",
    "arguments": "text, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_encrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_pub_encrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_decrypt",
    "return_type": "text",
    "arguments": "bytea, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_decrypt",
    "return_type": "text",
    "arguments": "bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_decrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_decrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_encrypt",
    "return_type": "bytea",
    "arguments": "text, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_encrypt",
    "return_type": "bytea",
    "arguments": "text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_encrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, text, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgp_sym_encrypt_bytea",
    "return_type": "bytea",
    "arguments": "bytea, text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgrst_ddl_watch",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "pgrst_drop_watch",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "set_graphql_placeholder",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_generate_v1",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_generate_v1mc",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_generate_v3",
    "return_type": "uuid",
    "arguments": "namespace uuid, name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_generate_v4",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_generate_v5",
    "return_type": "uuid",
    "arguments": "namespace uuid, name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_nil",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_ns_dns",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_ns_oid",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_ns_url",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "extensions",
    "function_name": "uuid_ns_x500",
    "return_type": "uuid",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "_internal_resolve",
    "return_type": "jsonb",
    "arguments": "query text, variables jsonb DEFAULT '{}'::jsonb, \"operationName\" text DEFAULT NULL::text, extensions jsonb DEFAULT NULL::jsonb",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "comment_directive",
    "return_type": "jsonb",
    "arguments": "comment_ text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "exception",
    "return_type": "text",
    "arguments": "message text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "get_schema_version",
    "return_type": "integer",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "increment_schema_version",
    "return_type": "event_trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql",
    "function_name": "resolve",
    "return_type": "jsonb",
    "arguments": "query text, variables jsonb DEFAULT '{}'::jsonb, \"operationName\" text DEFAULT NULL::text, extensions jsonb DEFAULT NULL::jsonb",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "graphql_public",
    "function_name": "graphql",
    "return_type": "jsonb",
    "arguments": "\"operationName\" text DEFAULT NULL::text, query text DEFAULT NULL::text, variables jsonb DEFAULT NULL::jsonb, extensions jsonb DEFAULT NULL::jsonb",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "pgbouncer",
    "function_name": "get_auth",
    "return_type": "TABLE(username text, password text)",
    "arguments": "p_usename text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "apply_rls",
    "return_type": "SETOF realtime.wal_rls",
    "arguments": "wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "broadcast_changes",
    "return_type": "void",
    "arguments": "topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "build_prepared_statement_sql",
    "return_type": "text",
    "arguments": "prepared_statement_name text, entity regclass, columns realtime.wal_column[]",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "cast",
    "return_type": "jsonb",
    "arguments": "val text, type_ regtype",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "check_equality_op",
    "return_type": "boolean",
    "arguments": "op realtime.equality_op, type_ regtype, val_1 text, val_2 text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "is_visible_through_filters",
    "return_type": "boolean",
    "arguments": "columns realtime.wal_column[], filters realtime.user_defined_filter[]",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "list_changes",
    "return_type": "SETOF realtime.wal_rls",
    "arguments": "publication name, slot_name name, max_changes integer, max_record_bytes integer",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "quote_wal2json",
    "return_type": "text",
    "arguments": "entity regclass",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "send",
    "return_type": "void",
    "arguments": "payload jsonb, event text, topic text, private boolean DEFAULT true",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "subscription_check_filters",
    "return_type": "trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "to_regrole",
    "return_type": "regrole",
    "arguments": "role_name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "realtime",
    "function_name": "topic",
    "return_type": "text",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "can_insert_object",
    "return_type": "void",
    "arguments": "bucketid text, name text, owner uuid, metadata jsonb",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "extension",
    "return_type": "text",
    "arguments": "name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "filename",
    "return_type": "text",
    "arguments": "name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "foldername",
    "return_type": "text[]",
    "arguments": "name text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "get_size_by_bucket",
    "return_type": "TABLE(size bigint, bucket_id text)",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "list_multipart_uploads_with_delimiter",
    "return_type": "TABLE(key text, id text, created_at timestamp with time zone)",
    "arguments": "bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "list_objects_with_delimiter",
    "return_type": "TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)",
    "arguments": "bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "operation",
    "return_type": "text",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "search",
    "return_type": "TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)",
    "arguments": "prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "storage",
    "function_name": "update_updated_at_column",
    "return_type": "trigger",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "vault",
    "function_name": "_crypto_aead_det_decrypt",
    "return_type": "bytea",
    "arguments": "message bytea, additional bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea, nonce bytea DEFAULT NULL::bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "vault",
    "function_name": "_crypto_aead_det_encrypt",
    "return_type": "bytea",
    "arguments": "message bytea, additional bytea, key_id bigint, context bytea DEFAULT '\\x7067736f6469756d'::bytea, nonce bytea DEFAULT NULL::bytea",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "vault",
    "function_name": "_crypto_aead_det_noncegen",
    "return_type": "bytea",
    "arguments": "",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "vault",
    "function_name": "create_secret",
    "return_type": "uuid",
    "arguments": "new_secret text, new_name text DEFAULT NULL::text, new_description text DEFAULT ''::text, new_key_id uuid DEFAULT NULL::uuid",
    "function_type": "FUNCTION"
  },
  {
    "schema_name": "vault",
    "function_name": "update_secret",
    "return_type": "void",
    "arguments": "secret_id uuid, new_secret text DEFAULT NULL::text, new_name text DEFAULT NULL::text, new_description text DEFAULT NULL::text, new_key_id uuid DEFAULT NULL::uuid",
    "function_type": "FUNCTION"
  }
]





Query 7: Database Roles
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin,
    rolreplication,
    rolbypassrls,
    rolconnlimit,
    rolvaliduntil
FROM pg_roles
ORDER BY rolname;

Query 7 result:
[
  {
    "rolname": "anon",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "authenticated",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "authenticator",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "dashboard_user",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": false,
    "rolreplication": true,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_checkpoint",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_create_subscription",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_database_owner",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_execute_server_program",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_maintain",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_monitor",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_read_all_data",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_read_all_settings",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_read_all_stats",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_read_server_files",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_signal_backend",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_stat_scan_tables",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_use_reserved_connections",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_write_all_data",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pg_write_server_files",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "pgbouncer",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "postgres",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": true,
    "rolreplication": true,
    "rolbypassrls": true,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "service_role",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": true,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_admin",
    "rolsuper": true,
    "rolinherit": true,
    "rolcreaterole": true,
    "rolcreatedb": true,
    "rolcanlogin": true,
    "rolreplication": true,
    "rolbypassrls": true,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_auth_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": true,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_read_only_user",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": false,
    "rolbypassrls": true,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_realtime_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": false,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_replication_admin",
    "rolsuper": false,
    "rolinherit": true,
    "rolcreaterole": false,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": true,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  },
  {
    "rolname": "supabase_storage_admin",
    "rolsuper": false,
    "rolinherit": false,
    "rolcreaterole": true,
    "rolcreatedb": false,
    "rolcanlogin": true,
    "rolreplication": false,
    "rolbypassrls": false,
    "rolconnlimit": -1,
    "rolvaliduntil": null
  }
]







Query 8: Table Permissions
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
ORDER BY table_name, grantee, privilege_type;

Query 8 result:
[
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "health_data",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "anon",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "authenticated",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "DELETE",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "INSERT",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "REFERENCES",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "SELECT",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRIGGER",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRUNCATE",
    "is_grantable": "YES"
  },
  {
    "grantee": "postgres",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "UPDATE",
    "is_grantable": "YES"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "DELETE",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "INSERT",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "REFERENCES",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "SELECT",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRIGGER",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "TRUNCATE",
    "is_grantable": "NO"
  },
  {
    "grantee": "service_role",
    "table_schema": "public",
    "table_name": "profiles",
    "privilege_type": "UPDATE",
    "is_grantable": "NO"
  }
]






Query 9: Auth Users Summary
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as confirmed_users,
    COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_users,
    MIN(created_at) as first_user_created,
    MAX(created_at) as last_user_created
FROM auth.users;


Query 9 result:
[
  {
    "total_users": 5,
    "confirmed_users": 5,
    "deleted_users": 0,
    "first_user_created": "2025-06-18 19:15:26.468073+00",
    "last_user_created": "2025-06-29 04:31:45.169302+00"
  }
]



Query 10: Profiles Data Summary
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN full_name IS NOT NULL THEN 1 END) as profiles_with_names,
    COUNT(CASE WHEN patient_password IS NOT NULL THEN 1 END) as profiles_with_passwords,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as profiles_with_emails
FROM profiles;


Query 10 result:
[
  {
    "total_profiles": 4,
    "profiles_with_names": 4,
    "profiles_with_passwords": 3,
    "profiles_with_emails": 4
  }
]



Query 11: Health Data Summary
SELECT 
    COUNT(*) as total_health_records,
    COUNT(DISTINCT user_id) as unique_patients,
    COALESCE(MIN(week_number), 0) as min_week,
    COALESCE(MAX(week_number), 0) as max_week,
    COUNT(CASE WHEN data_entered_by = 'patient' THEN 1 END) as patient_entries,
    COUNT(CASE WHEN data_entered_by = 'dr_nick' THEN 1 END) as doctor_entries,
    COUNT(CASE WHEN needs_review = true THEN 1 END) as pending_reviews,
    MIN(date) as earliest_date,
    MAX(date) as latest_date
FROM health_data;



Query 11 result:
[
  {
    "total_health_records": 34,
    "unique_patients": 4,
    "min_week": 0,
    "max_week": 23,
    "patient_entries": 16,
    "doctor_entries": 0,
    "pending_reviews": 24,
    "earliest_date": "2024-01-15",
    "latest_date": "2025-07-03"
  }
]







Query 12: Image Storage Analysis
SELECT 
    COUNT(*) as total_records_with_images,
    COUNT(CASE WHEN lumen_day1_image IS NOT NULL THEN 1 END) as records_with_lumen_day1,
    COUNT(CASE WHEN lumen_day7_image IS NOT NULL THEN 1 END) as records_with_lumen_day7,
    COUNT(CASE WHEN food_log_day1_image IS NOT NULL THEN 1 END) as records_with_food_day1,
    COUNT(CASE WHEN food_log_day7_image IS NOT NULL THEN 1 END) as records_with_food_day7,
    COUNT(CASE WHEN weekly_whoop_pdf_url IS NOT NULL THEN 1 END) as records_with_weekly_pdf,
    COUNT(CASE WHEN monthly_whoop_pdf_url IS NOT NULL THEN 1 END) as records_with_monthly_pdf
FROM health_data;

Query 12 result:

[
  {
    "total_records_with_images": 34,
    "records_with_lumen_day1": 7,
    "records_with_lumen_day7": 4,
    "records_with_food_day1": 0,
    "records_with_food_day7": 0,
    "records_with_weekly_pdf": 3,
    "records_with_monthly_pdf": 0
  }
]






Query 13: Database Extensions
SELECT 
    extname,
    extversion,
    extrelocatable,
    extconfig
FROM pg_extension
ORDER BY extname;

Query 13 result:
[
  {
    "extname": "pg_graphql",
    "extversion": "1.5.11",
    "extrelocatable": false,
    "extconfig": null
  },
  {
    "extname": "pg_stat_statements",
    "extversion": "1.11",
    "extrelocatable": true,
    "extconfig": null
  },
  {
    "extname": "pgcrypto",
    "extversion": "1.3",
    "extrelocatable": true,
    "extconfig": null
  },
  {
    "extname": "plpgsql",
    "extversion": "1.0",
    "extrelocatable": false,
    "extconfig": null
  },
  {
    "extname": "supabase_vault",
    "extversion": "0.3.1",
    "extrelocatable": false,
    "extconfig": [
      16656
    ]
  },
  {
    "extname": "uuid-ossp",
    "extversion": "1.1",
    "extrelocatable": true,
    "extconfig": null
  }
]






Query 14: Database Settings
SELECT 
    name,
    setting,
    unit,
    context,
    source
FROM pg_settings
WHERE name IN (
    'max_connections',
    'shared_buffers',
    'work_mem',
    'maintenance_work_mem',
    'effective_cache_size',
    'checkpoint_completion_target',
    'wal_buffers',
    'default_statistics_target',
    'random_page_cost',
    'effective_io_concurrency',
    'max_worker_processes',
    'max_parallel_workers_per_gather',
    'max_parallel_workers',
    'max_parallel_maintenance_workers'
)
ORDER BY name;

Query 14 result:
[
  {
    "name": "checkpoint_completion_target",
    "setting": "0.9",
    "unit": null,
    "context": "sighup",
    "source": "configuration file"
  },
  {
    "name": "default_statistics_target",
    "setting": "100",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "effective_cache_size",
    "setting": "49152",
    "unit": "8kB",
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "effective_io_concurrency",
    "setting": "200",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "maintenance_work_mem",
    "setting": "32768",
    "unit": "kB",
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "max_connections",
    "setting": "60",
    "unit": null,
    "context": "postmaster",
    "source": "configuration file"
  },
  {
    "name": "max_parallel_maintenance_workers",
    "setting": "1",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "max_parallel_workers",
    "setting": "2",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "max_parallel_workers_per_gather",
    "setting": "1",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "max_worker_processes",
    "setting": "6",
    "unit": null,
    "context": "postmaster",
    "source": "configuration file"
  },
  {
    "name": "random_page_cost",
    "setting": "1.1",
    "unit": null,
    "context": "user",
    "source": "configuration file"
  },
  {
    "name": "shared_buffers",
    "setting": "28672",
    "unit": "8kB",
    "context": "postmaster",
    "source": "configuration file"
  },
  {
    "name": "wal_buffers",
    "setting": "492",
    "unit": "8kB",
    "context": "postmaster",
    "source": "configuration file"
  },
  {
    "name": "work_mem",
    "setting": "2184",
    "unit": "kB",
    "context": "user",
    "source": "configuration file"
  }
]








Query 15: Sample Profile Data
SELECT 
    id::text as profile_id,
    email,
    full_name,
    patient_password
FROM profiles
ORDER BY email
LIMIT 10;


Query 15 result:
[
  {
    "profile_id": "74081b04-5169-463e-b24d-27a0088cb704",
    "email": "axel@automatedbots.com",
    "full_name": "Axel",
    "patient_password": null
  },
  {
    "profile_id": "f9c82d0e-0ded-48a2-82e6-99f27726a42c",
    "email": "axel@measurezpro.com",
    "full_name": "Test 2",
    "patient_password": "password"
  },
  {
    "profile_id": "c166b073-fc17-4cc6-93d2-e51c99503158",
    "email": "axelmartinez932@gmail.com",
    "full_name": "Test",
    "patient_password": "test296"
  },
  {
    "profile_id": "11418916-3f2b-4366-9881-1b1ba489edbb",
    "email": "usmade@measurezpro.com",
    "full_name": "test 3",
    "patient_password": "password"
  }
]

## **🚨 CRITICAL PRODUCTION BLOCKERS IDENTIFIED**
*Based on Supabase Data Analysis - Must Fix Before Go-Live*

### **BLOCKER #1: Security Vulnerability - Plain Text Passwords**
**Issue**: Patient passwords stored in plain text in profiles table
```sql
"patient_password": "test296"
"patient_password": "password"
```
**Risk**: Major security breach, GDPR/privacy violation
**Action**: Remove patient_password field, use Supabase auth exclusively
**Priority**: P0 - Block deployment

### **BLOCKER #2: Data Integrity - Future Dates**
**Issue**: Health records dated in future (2025-07-03)
**Risk**: Data quality issues, reporting errors, client confusion
**Action**: Add date validation, audit all historical data
**Priority**: P0 - Block deployment

### **BLOCKER #3: Operational Overload - Review Backlog**
**Issue**: 70% of records (24/34) need review
**Risk**: Dr. Nick will be overwhelmed with 20 active clients
**Action**: Implement auto-approval rules, review workflow optimization
**Priority**: P1 - Critical for operations

### **BLOCKER #4: Data Consistency - Entry Tracking**
**Issue**: Inconsistent data_entered_by values
**Risk**: Audit trail failures, compliance issues
**Action**: Standardize data entry attribution logic
**Priority**: P1 - Critical for operations

### **MUST-FIX CHECKLIST BEFORE PRODUCTION**
- [ ] **Remove plain text passwords** from profiles table
- [ ] **Implement date validation** (no future dates)
- [ ] **Clean up historical data** (fix future dates)
- [ ] **Create review workflow** optimization
- [ ] **Standardize data entry** attribution
- [ ] **Add data validation** constraints
- [ ] **Implement backup strategy**
- [ ] **Set up monitoring** and alerting
- [ ] **Test disaster recovery** procedures
- [ ] **Performance test** with 20 concurrent users

### **RECOMMENDED PRODUCTION TIMELINE**
- **Week 1-2**: Fix security vulnerabilities and data validation
- **Week 3-4**: Implement operational improvements
- **Week 5-6**: Testing and monitoring setup
- **Week 7-8**: Production deployment with limited users

**DECISION**: Based on current analysis, **DO NOT DEPLOY** until critical blockers are resolved.