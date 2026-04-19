import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const db = await getDb();

    const clientDocs = await db.collection('clients').find({}).sort({ name: 1 }).toArray();
    if (clientDocs.length > 0) {
      const clients = clientDocs.map((client: any) => ({
        id: client._id?.toString() || '',
        name: client.name || client.clientName || 'Unknown',
        type: client.clientType || client.type || 'FARMER',
        address: client.address || client.clientLocation || '',
        mobile: client.mobile || client.contactInfo?.mobile || client.contactInfo?.phone || '',
      }));

      return NextResponse.json({
        success: true,
        clients
      });
    }

    const accountDocs = await db.collection('client_accounts').find({}).sort({ clientName: 1 }).toArray();
    const clients = accountDocs.map((client: any) => ({
      id: client._id?.toString() || `legacy-${Date.now()}`,
      name: client.clientName || client.name || 'Unknown',
      type: client.clientType || 'FARMER',
      address: client.clientLocation || client.address || '',
      mobile: client.contactInfo?.mobile || client.contactInfo?.phone || '',
    }));

    return NextResponse.json({
      success: true,
      clients
    });

  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, address, mobile, otherDetails } = body;

    if (!name || !type || !address || !mobile) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: name, type, address, mobile'
      }, { status: 400 });
    }

    const db = await getDb();

    const client = {
      name,
      type,
      address,
      mobile,
      otherDetails: otherDetails || '',
      userId: (session.user as any).id,
      userEmail: session.user.email,
      createdAt: new Date(),
    };

    const result = await db.collection('clients').insertOne(client);

    return NextResponse.json({
      success: true,
      message: 'Client created successfully',
      client: {
        id: result.insertedId.toString(),
        ...client
      }
    });

  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create client' },
      { status: 500 }
    );
  }
}