'use client'

import { Box, Button, Stack, TextField } from "@mui/material";
import Image from "next/image";
import { useState } from "react";

export default function Home() {
  // Initialize state to hold the conversation messages
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm the Rate my professor support assitant. How can I help you today?"
    }
  ]);
  // Initialize state to hold the current message being typed by the user

  const [message, setMessage] = useState('')

  const sendMessage = async() => {
    // Update the messages state to include the user's message and a placeholder for the assistant's response
    setMessages((messages) => [
      ...messages, // Keep all existing messages
        { role: 'user', content: message }, // Add the user's new message
        { role: 'assistant', content: '' }  // Add an empty message for the assistant's response

    ])
    setMessage('')

    // Send the user's message to the server to get the assistant's response
    const response = fetch('/api/chat', {
      method:"POST",
      headers:{
        'Content-Type': "application/json"
      },
      // Send the entire conversation history plus the new user message to the server
      body: JSON.stringify([...messages, {role:'user', content: message}])
    }).then(async (res) => {
      // Get the response body as a readable stream
      const reader = res.body.getReader()
      // Create a decoder to convert the stream of bytes into text
      const decoder = new TextDecoder()

      let result = '' // Initialize a variable to store the assistant's response
      
      // Process the response stream
      return reader.read().then(function processText({done, value}) {
        if(done){
          // If the stream is done, return the accumulated result
          return result
        }
        // Decode the current chunk of the stream into text
        const text = decoder.decode(value || new Uint8Array(), {stream: true})
      // Update the messages state to append the new text to the assistant's response
      setMessages((messages) => {
        let lastMessage = messages[messages.length - 1] // Get the last message, which is the assistant's placeholder
        let otherMessages = messages.slice(0, messages.length - 1) // Get all other messages

        return [
            ...otherMessages, // Keep all the previous messages
            { ...lastMessage, content: lastMessage.content + text } // Append the new text to the assistant's response
        ]
    })
      // Continue reading the next chunk of the stream done recursivelt
      return reader.read().then(processText)
    })
  })
}

  return (

    
    <Box
      width='100vw'
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      // borderRadius={}
      >


        <Stack
          direction="column"
          width="500px"
          height="700px"
          border='1px solid black'
          p={2}
          spacing={3}
          >
            <Stack
              direction={"column"}
              spacing={2}
              flexGrow={1}
              overflow={'auto'}
              border="1px solid black"
              p={2}
              >
            {
              messages.map((message, index)=> (
                // placement of chat box
                <Box 
                  key={index} 
                  display="flex"
                  justifyContent={
                    message.role === "assistant" ? "flex-start" : "flex-end"}>
                    {/* actual chat display itself */}
                    <Box
                      bgcolor={message.role  === "assistant" ? "primary.main": "secondary.main"}
                      color = "white"
                      borderRadius={16}
                      p={3}
                      >
                      {message.content}
                    </Box>
                  </Box>
              ))
              // now we need our text box

            }
          </Stack>
          <Stack
            direction="row"
            spacing = {2}>
            <TextField
              label = "Message"
              fullWidth
              value={message}
              onChange={(e)=>{
                setMessage(e.target.value)
              }}/>



            <Button variant="contained" onClick={sendMessage}> 
              Send
            </Button>

          </Stack>
        </Stack>

        

    </Box>
  
  );
}
