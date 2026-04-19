import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // 1. Validate Input
    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { message: 'Invalid input. Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCollection = db.collection('users');

    // 2. Check for existing user
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { message: 'A user with this email id already exists.' },
        { status: 400 }
      );
    }

    // 3. Hash Password
    // 12 salt rounds is standard for bcrypt to balance performance and security
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Insert into Database
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      role: 'PICKER', // Default Role mapping
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: 'User created successfully.', userId: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
