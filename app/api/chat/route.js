import { NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import OpenAI from 'openai'


const systemPrompt = `You are an intelligent assistant designed to help students find professors based on their specific queries. When a student asks about a professor, you will use a retrieval system to search for relevant information and return the top three professors that best match their query. Your responses should be informative, clear, and helpful, providing key details about each professor that align with the student's interests.

When responding:
1. Retrieve the top 3 professors who best match the student's query.
2. Include relevant details such as the professor's name, department, average rating, notable feedback, and any other pertinent information.
3. If the student's query includes specific criteria (e.g., "professors who are great at teaching calculus" or "professors with high ratings in computer science"), prioritize professors who meet these criteria.
4. If the student's query is vague or broad, provide a balanced selection of professors from different departments or fields.
5. Be polite, encouraging, and supportive, ensuring the student feels confident in their search for the right professor.

Examples:
- If a student asks, "Who are the best computer science professors?", respond with:
  "Here are the top 3 computer science professors based on student ratings:
  1. **Dr. Alice Smith** - Known for her engaging lectures in AI and Machine Learning, with an average rating of 4.8/5. Students appreciate her deep knowledge and approachable nature.
  2. **Dr. John Doe** - Specializes in algorithms and data structures, with an average rating of 4.7/5. He is praised for his clear explanations and willingness to help students outside of class.
  3. **Dr. Emily Johnson** - Focuses on software engineering, with an average rating of 4.6/5. Students find her practical approach and real-world examples very beneficial."

- If a student asks, "Which professors are good at explaining calculus?", respond with:
  "Here are the top 3 professors who excel at teaching calculus:
  1. **Dr. Michael Brown** - A mathematics professor with a rating of 4.9/5. He is highly praised for his clear and structured approach to teaching calculus.
  2. **Dr. Sarah Lee** - Known for making complex topics understandable, with an average rating of 4.8/5 in her calculus courses.
  3. **Dr. Robert White** - Focuses on calculus and differential equations, with a rating of 4.7/5. Students appreciate his thorough explanations and interactive teaching style."

Ensure that your response is concise but informative, giving the student a clear idea of which professors might best meet their needs. `


export async function POST(req){
    const data = await req.json()
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    }   
    )
    const index = pc.index('rag').namespace('ns1')
    const openai = new OpenAI()

    // last message with chat below and reads data
    // Extract the content of the last message from the student query.
    const text = data[data.length -1].content
        
    // Generate an embedding (a vector representation) for the extracted text using OpenAI.
    const embedding = await openai.embeddings.create({
        model:'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
    })

    // Query Pinecone with the generated embedding to find the top 3 matching professors.
    const results = await index.query({
        topK:3,
        includeMetadata:true,
        vector: embedding.data[0].embedding
    })

    // Initialize a string to store the retrieved professor information.
    let resultString = 
    '\n\n Returned result from vector db (done automatically)'
    results.matches.forEach((match) =>{
        resultString += `\n

        Professor: ${match.id}
        Review: ${match.metadata.stars}
        Subject: ${match.metadata.subject}
        Stars: ${match.metadata.stars}
        \n\n
        `
    })

// generaate reult with embedding
const lastMessage = data[data.length - 1] // Retrieve the last element from the data array, usually the most recent message or input

const lastMessageContent = lastMessage.content + resultString // Combine the content of the last message with additional information (resultString with new emebedding info)

const lastDatawithoutlastMessage = data.slice(0, data.length - 1) // Create a new array containing all elements except the last one, often used when handling the last message separately
const completion = await openai.chat.completions.create({
    messages: [
        {role: 'system', content: systemPrompt}, // System prompt with instructions.
        ...lastDatawithoutlastMessage, // previous chat
        {role:'user', content:lastMessageContent} // The last user message with the retrieved results appended.
    ],
    model: 'gpt-4o-mini',
    stream: true, //streams line into chunks
    
})

    // A ReadableStream allows you to process data in chunks as it arrives,
    //  making it ideal for scenarios where you don't want to wait for all data before starting to process it. 
    // Create a readable stream to handle the streaming response from OpenAI.
    const stream = new ReadableStream({
        // The `start` function is called immediately when the stream is created.
        // The `controller` object is passed into this function, which allows us to manage the stream.
        async start(controller) {
            // Define the TextEncoder instance here
            const encoder =  new TextEncoder()
            //The TextEncoder is used to convert strings into Uint8Array, which is required for streaming binary data.

            try {
                // Process the streamed response chunk by chunk from the OpenAI API.
                for await (const chunk of completion) {
                    // Extract the content from the current chunk.
                    const content = chunk.choices[0]?.delta?.content
                    if (content) {
                        // If the content exists, encode it into a format suitable for streaming.
                        const text = encoder.encode(content) 
                        
                        // Use the controller to enqueue this encoded text into the stream.
                        // This sends the chunk of data to the client.
                        controller.enqueue(text)
                    }
                }
            } catch (err) {
                // If an error occurs during the streaming process, report the error through the controller.
                // This stops the stream and indicates that something went wrong.
                controller.error(err)
            } finally {
                // Once all chunks have been processed (or if an error occurred), close the stream.
                // This signals to the client that the response is complete and no more data will be sent.
                controller.close()
            }
        }, 
    })

    return new NextResponse(stream)
}
