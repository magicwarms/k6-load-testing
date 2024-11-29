import { Trend } from 'k6/metrics';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

// Custom metrics for more comprehensive tracking
const myTrend = new Trend('staging_api_trend');
const responseTimeTrend = new Trend('response_time_trend');
const waitTimeTrend = new Trend('wait_time_trend');

export const options = {
    // More comprehensive load test stages
    stages: [
        { duration: '30s', target: 5 },   // Ramp up gradually
        { duration: '30s', target: 50 },   // Peak load
        { duration: '30s', target: 25 },   // Moderate load
        { duration: '20s', target: 0 },    // Ramp down
    ],
    
    // Stricter thresholds for performance monitoring
    thresholds: {
        'http_req_failed': ['rate<0.01'],  // Maximum 1% error rate
        'http_req_duration': ['p(95)<200', 'p(99)<500'], // More detailed response time checks
        'staging_api_trend': ['avg<150', 'max<300'], // Enhanced custom metric thresholds
        'http_req_receiving': ['max<5000'], // Tightened max receive time
        'http_req_sending': ['max<1000'],
        'iterations': ['rate>5'], // Ensure minimum iteration rate
    },

    // Add more configuration for more realistic load testing
    summaryTimeUnit: 'ms',
    summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'count'],
};

// Enhanced error handling and logging
export function handleSummary(data) {
    // Generate HTML report
    const htmlReportContent = htmlReport(data);
    
    // Optional: Add more detailed logging or custom processing
    console.log('Total Iterations:', data.root_group.checks[0].passes);
    
    return {
        "report.html": htmlReportContent,
        // Optional: Generate additional output files
        "summary.json": JSON.stringify(data, null, 2),
    };
}

export default function () {
    // More realistic wait time simulation with logging
    const waitTime = Math.random() * 4 + 1; // 1-5 seconds
    waitTimeTrend.add(waitTime * 1000); // Convert to ms for tracking
    sleep(waitTime);

    // Multiple API endpoint checks for more comprehensive testing
    const endpoints = [
        'https://staging-api.locoscents.id/api/v1/health',
        'https://staging-api.locoscents.id/api/v1/front/banners?page=1&perPage=10',
        'https://staging-api.locoscents.id/api/v1/front/banner-categories?page=1&perPage=10',
        // Add more endpoints to test if needed
    ];

    endpoints.forEach(endpoint => {
        // Improved request with timeout and tags
        const params = {
            tags: { 
                name: 'Health Check, Banners and Banner Categories',
                endpoint: endpoint 
            },
            timeout: '10s' // Added request timeout
        };

        const request = http.get(endpoint, params);

        // More comprehensive checks
        const checkResult = check(request, {
            'status is 200': (r) => r.status === 200,
            'response time < 200ms': (r) => r.timings.duration < 200,
            'response body not empty': (r) => r.body.length > 0,
            'meaningful error handling': (r) => {
              if (r.status !== 200) {
                console.error(`Failed request: ${r.url}, Status: ${r.status}`);
                return false;
              }
              return true;
            }
        });

        // Track response metrics
        myTrend.add(request.timings.duration);
        responseTimeTrend.add(request.timings.duration);

        // Optional: Log failed requests
        if (!checkResult) {
            console.error(`Request to ${endpoint} failed`, request);
        }
    });
}