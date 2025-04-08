import { NextResponse, type NextRequest } from "next/server";
import { pinata } from "@/lib/config";

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const title = data.title;
        const description = data.description;
        const { cid } = await pinata.upload.public.json({
            title,
            description,
        });
        const url = await pinata.gateways.public.convert(cid);
        console.log(url);
        return NextResponse.json(url, { status: 200 });
    } catch (e) {
        console.log(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
