import { Agent, run, tool } from '@openai/agents';
import 'dotenv/config';
import e from 'express';
import z from 'zod';

const getCurrentTime = tool({
    name: 'getCurrentTime',
    description: 'Get the current time in the kitchen by this tool.',
    parameters: z.object({}),
    async execute() {
        return new Date().toString();
    }
})

const getMenu = tool({
    name: 'getMenu',
    description: 'Returns the menu item.',
    parameters: z.object({}),
    async execute() {
        return {
            "drinks": {
                "coffee": "INR 20",
                "tea": "INR 10",
                "juice": "INR 50"
            },

            "Food": {
                'dal': "INR 30",
                'rice': "INR 20",
                'roti': "INR 10"
            }
        }
    }
})

const agent = new Agent({
    name: 'cooking_agent',
    instructions: 'You are a cook who make tasty foods.',
    tools: [getCurrentTime, getMenu]
});

const codingAgent = new Agent({
    name: 'coding_agent',
    instructions: 'You are an expert coding assistant.',
    //   tools:[getCurrentTime,getMenu]
});

const gatewayAgent = Agent.create({
    name: 'gateway_agent',
    instructions: 'You determine which agent to use.',
    handoffs: [agent, codingAgent]
    //   tools:[getCurrentTime,getMenu]
});
async function chatwithAgent(query) {
    const result = await run(gatewayAgent, query)
    console.log(result.history);
    console.log(result.finalOutput);

}

chatwithAgent("Depending on current time what dish  you prepare me to eat? What type of items available to eat or drink.")