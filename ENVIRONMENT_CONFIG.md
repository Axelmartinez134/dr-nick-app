# 🔧 ENVIRONMENT CONFIGURATION GUIDE

## **Required Environment Variables**

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Service Role Key (for admin operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Grok AI API Configuration (for Dr. Nick's AI analysis feature)
GROK_API_BASE_URL=https://api.x.ai/v1
GROK_API_KEY=your_grok_api_key_here
GROK_MODEL=grok-3-latest
```

## **Database Configuration**

### **Admin Email Setup**
The admin email address is hardcoded in the RLS policies. Before deploying:

1. **Update RLS Policies**: Replace `{ADMIN_EMAIL}` placeholder with actual admin email in all policies
2. **Update Application Code**: Ensure the email matches in `AuthContext.tsx` and other admin detection logic

### **Example RLS Policy Update**
```sql
-- Before (placeholder)
CREATE POLICY "Dr Nick can view all profiles" ON profiles
  FOR SELECT USING (auth.email() = '{ADMIN_EMAIL}');

-- After (actual email)
CREATE POLICY "Dr Nick can view all profiles" ON profiles
  FOR SELECT USING (auth.email() = 'admin@yourdomain.com');
```

## **Security Best Practices**

- ✅ **Never commit** `.env.local` to version control
- ✅ **Use placeholders** in documentation files
- ✅ **Create separate configs** for development/staging/production
- ✅ **Rotate keys** regularly in production
- ✅ **Use environment-specific** Supabase projects

## **Setup Instructions**

1. **Copy this template** to `.env.local`
2. **Replace placeholders** with actual values from your Supabase project
3. **Update RLS policies** in Supabase dashboard with actual admin email
4. **Test authentication** to ensure admin detection works
5. **Verify RLS policies** are working correctly

## **Supabase Project Setup**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create new project or select existing
3. Go to Settings → API to find your keys
4. Copy `URL` and `anon/public` key
5. Set up your database schema and RLS policies

## **Production Considerations**

- Use **separate Supabase projects** for dev/staging/production
- Consider using **Supabase CLI** for schema migrations
- Set up **automated backups** for production
- Monitor **API usage** and set up billing alerts 