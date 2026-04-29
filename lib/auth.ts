import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getDb } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'email@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error('Email and password are required');
          }

          console.log("👉 Login attempt:", credentials.email);

          const db = await getDb();

          const user = await db.collection('users').findOne({ email: credentials.email });

          console.log("👉 User from DB:", user);

          if (!user) {
            throw new Error('No user found with this email');
          }

          // Check if user is active
          console.log("👉 User status:", user.status);

          if (user.status === 'INACTIVE') {
            throw new Error('Your account has been deactivated.');
          }

          console.log("👉 Entered password:", credentials.password);
          console.log("👉 Stored password:", user.password);

          const isValid = await bcrypt.compare(credentials.password, user.password);

          console.log("👉 Password match:", isValid);

          if (!isValid) {
            throw new Error('Invalid password');
          }

          return {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
          };

        } catch (error) {
          console.error("❌ AUTH ERROR:", error);
          throw error;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    // Append user details to the JWT token
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    // Pass the token details to the Client Session object
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/', // Specify your custom login page route
  },
  secret: process.env.NEXTAUTH_SECRET,
};
