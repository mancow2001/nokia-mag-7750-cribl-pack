// Enhanced Nokia Parser - Supports MAG-c AND 7750 SR formats
exports.name = 'nokia_enhanced_parser';
exports.version = '3.0.0';
exports.disabled = false;
exports.group = 'Nokia Enhanced';

const { Expression } = C;

let parser;

exports.init = (opts) => {
  const conf = opts.conf || {};
  
  const patterns = [
    // Nokia 7750 SR format (your logs)
    {
      type: '7750_sr',
      regex: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+\d{2}:\d{2})\s+(\S+)\s+(\w+)\[(\d+)\]:\s+\[(\d+)\]\[(\d+)\]\[([A-Z])\]\[(\d+)\]\s+\[(\d+)\]\s+([^:]+):\s+(.*)$/,
      fields: ['timestamp', 'hostname', 'process', 'pid', 'card1', 'card2', 'card_state', 'card_id', 'num', 'source_file', 'structured_data']
    },
    // Nokia MAG-c format (original)
    {
      type: 'mag_c',
      regex: /^(\d+)\s+(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{2})\s+(\w+)\s+(\w+):\s+(\w+)\s+#(\d+)\s+(\S+)\s+(.+)$/,
      fields: ['sequence', 'timestamp', 'timezone', 'severity', 'application', 'event_id', 'router', 'subject_message']
    },
    // Syslog format forwarded from Nokia
    {
      type: 'syslog',
      regex: /^<(\d+)>(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{2})\s+(\S+)\s+(\w+):\s+(\w+)\s+#(\d+)\s+(\S+)\s+(.+)$/,
      fields: ['priority', 'timestamp', 'hostname', 'severity', 'application', 'event_id', 'router', 'subject_message']
    }
  ];
  
  parser = {
    patterns,
    includeRawVariables: conf.includeRawVariables || false,
    strictParsing: conf.strictParsing || false,
    
    parseNokia7750StructuredData: (structuredData) => {
      const data = {};
      
      // Parse structured fields like "Id:2406, Syslog-Severity:6, Perceived-Severity:CLEAR"
      const fieldMatches = structuredData.match(/(\w+(?:-\w+)*):([^,]+)(?:,|$)/g);
      if (fieldMatches) {
        fieldMatches.forEach(match => {
          const [, key, value] = match.match(/(\w+(?:-\w+)*):([^,]+)/) || [];
          if (key && value) {
            // Convert key to snake_case and clean value
            const cleanKey = key.toLowerCase().replace(/-/g, '_');
            let cleanValue = value.trim();
            
            // Handle special Nokia values
            if (cleanValue === 'NULL' || cleanValue === '') {
              return; // Skip NULL values
            }
            
            // Parse numeric values
            if (/^\d+$/.test(cleanValue)) {
              data[cleanKey] = parseInt(cleanValue);
            } else {
              data[cleanKey] = cleanValue;
            }
          }
        });
      }
      
      return data;
    },
    
    parseNokiaVariables: (message) => {
      const variables = {};
      
      // Extract Nokia MAG-c variables (tmnxMobGw*, tmnxMc*, etc.)
      const variableMatches = message.match(/\$([a-zA-Z0-9_]+)\$/g);
      if (variableMatches && parser.includeRawVariables) {
        variableMatches.forEach(match => {
          const varName = match.slice(1, -1);
          variables[`raw_var_${varName}`] = true;
        });
      }
      
      // Parse common Nokia parameters
      const patterns = [
        { regex: /Gw-(\S+)/, field: 'gateway_id' },
        { regex: /Group-(\d+)/, field: 'system_group_id' },
        { regex: /Card-(\d+)/, field: 'card_slot' },
        { regex: /from:\s*([^,]+)/, field: 'config_source' },
        { regex: /to:\s*([^,]+)/, field: 'config_destination' },
        { regex: /Interface\s+([^\s,]+)/, field: 'interface_name' },
        { regex: /speed\s+(\w+)/, field: 'interface_speed' }
      ];
      
      patterns.forEach(pattern => {
        const match = message.match(pattern.regex);
        if (match) {
          variables[pattern.field] = match[1].trim();
        }
      });
      
      return variables;
    }
  };
};

exports.process = (event) => {
  const raw = event._raw;
  if (!raw) return event;
  
  let matched = false;
  let deviceType = 'unknown';
  
  for (const pattern of parser.patterns) {
    const match = raw.match(pattern.regex);
    if (match) {
      deviceType = pattern.type;
      
      // Parse basic fields
      for (let i = 0; i < pattern.fields.length; i++) {
        if (match[i + 1] !== undefined) {
          event[`nokia_${pattern.fields[i]}`] = match[i + 1];
        }
      }
      
      // Handle different device types
      if (deviceType === '7750_sr') {
        // Nokia 7750 SR specific processing
        event.device_type = 'nokia_7750_sr';
        event.product = 'Nokia 7750 SR';
        
        // Parse timestamp
        if (event.nokia_timestamp) {
          try {
            const timeObj = new Date(event.nokia_timestamp);
            if (!isNaN(timeObj.getTime())) {
              event._time = timeObj.getTime() / 1000;
            }
          } catch (e) {
            // Keep original if parsing fails
          }
        }
        
        // Parse structured data
        if (event.nokia_structured_data) {
          const structuredFields = parser.parseNokia7750StructuredData(event.nokia_structured_data);
          Object.keys(structuredFields).forEach(key => {
            event[`nokia_${key}`] = structuredFields[key];
          });
          
          // Extract meaningful message components
          if (structuredFields.details) {
            const detailsVars = parser.parseNokiaVariables(structuredFields.details);
            Object.keys(detailsVars).forEach(key => {
              if (typeof detailsVars[key] === 'string') {
                event[`nokia_${key}`] = detailsVars[key];
              }
            });
          }
        }
        
        // Build card information
        if (event.nokia_card1 && event.nokia_card2) {
          event.nokia_card_slot = `${event.nokia_card1}/${event.nokia_card2}`;
        }
        
      } else if (deviceType === 'mag_c') {
        // Nokia MAG-c specific processing
        event.device_type = 'nokia_mag_c';
        event.product = 'Nokia Multi-Access Gateway Controller';
        
        // Parse Nokia timestamp
        if (event.nokia_timestamp) {
          try {
            const nokiaTime = event.nokia_timestamp.replace(/\//g, '-');
            const timeObj = new Date(nokiaTime + (event.nokia_timezone === 'UTC' ? 'Z' : ''));
            if (!isNaN(timeObj.getTime())) {
              event._time = timeObj.getTime() / 1000;
            }
          } catch (e) {
            // Keep original timestamp if parsing fails
          }
        }
        
        // Extract Nokia variables
        if (event.nokia_subject_message) {
          const nokiaVars = parser.parseNokiaVariables(event.nokia_subject_message);
          Object.keys(nokiaVars).forEach(key => {
            if (typeof nokiaVars[key] === 'string') {
              event[`nokia_${key}`] = nokiaVars[key];
            }
          });
        }
      }
      
      matched = true;
      break;
    }
  }
  
  // Common Nokia processing
  if (matched) {
    event.vendor = 'nokia';
    event.nokia_device_type = deviceType;
    event.nokia_processed = true;
    
    // Handle syslog priority if present
    if (event.nokia_priority) {
      const pri = parseInt(event.nokia_priority);
      event.nokia_facility = Math.floor(pri / 8);
      event.nokia_severity_code = pri % 8;
    }
  } else if (parser.strictParsing) {
    // In strict mode, mark as failed if no pattern matches
    event.nokia_parse_failed = true;
  }
  
  return event;
};
