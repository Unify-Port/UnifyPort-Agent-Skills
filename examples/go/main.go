package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const protocolVersion = "2025-11-25"

func call(client *http.Client, endpoint string, apiKey string, payload map[string]any) (map[string]any, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Authorization", "Bearer "+apiKey)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json, text/event-stream")
	request.Header.Set("MCP-Protocol-Version", protocolVersion)

	// 不记录 header 或 body，避免 API Key 和业务参数进入日志。
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("MCP request failed with status %d", response.StatusCode)
	}
	if len(data) == 0 {
		return nil, nil
	}
	jsonData := data
	if strings.HasPrefix(response.Header.Get("Content-Type"), "text/event-stream") {
		for _, line := range strings.Split(string(data), "\n") {
			if strings.HasPrefix(line, "data: ") {
				jsonData = []byte(strings.TrimPrefix(line, "data: "))
			}
		}
	}
	var result map[string]any
	if err := json.Unmarshal(jsonData, &result); err != nil {
		return nil, fmt.Errorf("invalid MCP response: %w", err)
	}
	return result, nil
}

func main() {
	endpoint := os.Getenv("UNIFYPORT_MCP_URL")
	if endpoint == "" {
		endpoint = "http://127.0.0.1:8787/mcp"
	}
	apiKey := os.Getenv("UNIFYPORT_API_KEY")
	if apiKey == "" {
		panic("UNIFYPORT_API_KEY is required")
	}
	client := &http.Client{Timeout: 35 * time.Second}
	_, err := call(client, endpoint, apiKey, map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  "initialize",
		"params": map[string]any{
			"protocolVersion": protocolVersion,
			"capabilities":    map[string]any{},
			"clientInfo": map[string]any{
				"name": "go-backend", "version": "1.0.0",
			},
		},
	})
	if err != nil {
		panic(err)
	}
	_, err = call(client, endpoint, apiKey, map[string]any{
		"jsonrpc": "2.0", "method": "notifications/initialized", "params": map[string]any{},
	})
	if err != nil {
		panic(err)
	}
	result, err := call(client, endpoint, apiKey, map[string]any{
		"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": map[string]any{},
	})
	if err != nil {
		panic(err)
	}
	encoded, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(encoded))
}
