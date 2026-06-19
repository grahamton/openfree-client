import { test, expect } from "../fixtures";

test.describe("Tier 4: Real-World Application Scenarios", () => {

  test("1. Scenario 1: User switches to remote backend, types a remote server URL, enters a custom vocabulary prompt, and saves settings", async ({ settingsPage }) => {
    // User switches to Remote
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("remote");

    // User fills server URL
    const urlInput = settingsPage.locator("input[placeholder*='transcribe']");
    await urlInput.fill("http://10.0.0.5:8766/transcribe");

    // User enters a custom vocabulary prompt
    const promptTextarea = settingsPage.locator("textarea");
    await promptTextarea.fill("User names: Alice, Bob. Project: OpenFree.");

    // User saves settings
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    // Verify all saved
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("remote");
    expect(savedConfig.server_url).toBe("http://10.0.0.5:8766/transcribe");
    expect(savedConfig.initial_prompt).toBe("User names: Alice, Bob. Project: OpenFree.");
  });

  test("2. Scenario 2: User enables AI Cleanup with Ollama, sets the model to 'llama3', changes Ollama URL, and saves", async ({ settingsPage }) => {
    // User checks AI Cleanup
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    // User selects Ollama backend
    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("ollama");

    // User fills the Ollama URL and model name
    const urlInput = settingsPage.locator("input[placeholder='http://localhost:11434']");
    await urlInput.fill("http://192.168.1.150:11434");

    const modelInput = settingsPage.locator("input[placeholder='llama3.2']");
    await modelInput.fill("llama3");

    // User saves settings
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    // Verify all saved
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("ollama");
    expect(savedConfig.ai_ollama_url).toBe("http://192.168.1.150:11434");
    expect(savedConfig.ai_model).toBe("llama3");
  });

  test("3. Scenario 3: User tries to play debug recording but microphone had an error (playback fails and displays error)", async ({ settingsPage }) => {
    // Mock the backend play_debug_wav to fail due to mic error
    await settingsPage.evaluate(() => {
      (window as any).__PLAYBACK_ERROR__ = "Failed to open output audio stream: Default device not found";
    });

    // User clicks the Play button
    const playbackBtn = settingsPage.locator("button:has-text('Play Last Recording')");
    await playbackBtn.click();

    // Verify user sees the exact microphone/playback error message
    const errorMsg = settingsPage.locator("span:has-text('Failed to open output audio stream')");
    await expect(errorMsg).toBeVisible();
    await expect(errorMsg).toContainText("Default device not found");
  });

  test("4. Scenario 4: User selects CUDA hardware acceleration, selects a specific Whisper model path, and saves", async ({ settingsPage }) => {
    // User ensures Local backend is selected
    const backendSelect = settingsPage.locator("select").first();
    await backendSelect.selectOption("local");

    // User selects Whisper model from dropdown
    const modelSelect = settingsPage.locator("select").nth(1);
    await modelSelect.selectOption("C:\\models\\ggml-tiny.bin");

    // User selects CUDA acceleration
    const hwSelect = settingsPage.locator("select:has-text('CPU')");
    await hwSelect.selectOption("cuda");

    // User saves settings
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    // Verify all saved
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.transcription_mode).toBe("local");
    expect(savedConfig.whisper_model_path).toBe("C:\\models\\ggml-tiny.bin");
    expect(savedConfig.local_backend).toBe("cuda");
  });

  test("5. Scenario 5: User sets up OpenAI API key, enables smart rewrite mode, saves, and verifies everything is stored", async ({ settingsPage }) => {
    // User checks AI Cleanup
    const aiCleanupCheckbox = settingsPage.locator("input[type='checkbox']").nth(1);
    await aiCleanupCheckbox.check();

    // User selects OpenAI backend
    const aiBackendSelect = settingsPage.locator("select:has-text('LM Studio')");
    await aiBackendSelect.selectOption("openai");

    // User selects Smart mode
    const modeSelect = settingsPage.locator("select:has-text('Cleanup')");
    await modeSelect.selectOption("smart");

    // User enters key
    const keyInput = settingsPage.locator("input[placeholder='sk-...']");
    await keyInput.fill("sk-my-super-secret-key-for-transcription");

    // User saves settings
    const saveButton = settingsPage.locator("button:has-text('Save')");
    await saveButton.click();
    await expect(saveButton).toHaveText("Saved!");

    // Verify all saved
    const savedConfig = await settingsPage.evaluate(() => (window as any).__MOCK_CONFIG__);
    expect(savedConfig.ai_cleanup_enabled).toBe(true);
    expect(savedConfig.ai_backend).toBe("openai");
    expect(savedConfig.ai_mode).toBe("smart");
    expect(savedConfig.openai_api_key).toBe("sk-my-super-secret-key-for-transcription");
  });
});
