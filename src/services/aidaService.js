/* src/services/aidaService.js */
// A mock service to simulate calls to the AIDA backend API.

const aidaService = {
  /**
   * Simulates sending a message to the AIDA backend.
   * @param {object} payload - The message payload.
   * @param {string} payload.message - The user's message.
   * @param {string} [payload.userId] - The user's ID if they are logged in.
   * @param {string} payload.model - The selected AI model.
   * @returns {Promise<object>} A promise that resolves with the bot's response.
   */
  sendMessage: async ({ message, userId, model }) => {
    console.log('🚀 Sending message to AIDA backend:');
    console.log({
      message,
      userId: userId || 'anonymous',
      model,
      timestamp: new Date().toISOString(),
    });

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Simulate a response
    const botResponse = {
      id: `bot-${Date.now()}`,
      text: `This is a simulated response for "${message}" from the ${model} model. I see you are user: ${userId || 'anonymous'}.`,
      sender: 'bot',
      timestamp: new Date().toISOString(),
    };

    console.log('🤖 Received simulated response from AIDA:', botResponse);
    return botResponse;
  },
};

export default aidaService;