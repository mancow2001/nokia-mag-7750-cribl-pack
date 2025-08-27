// Enhanced Nokia Data Optimization - Handles Both Device Types
exports.name = 'nokia_enhanced_shrink';
exports.version = '3.0.0';
exports.disabled = false;
exports.group = 'Nokia Enhanced';

exports.process = (event) => {
  if (!event.nokia_processed) return event;
  
  const deviceType = event.nokia_device_type;
  const compressionLevel = this.conf?.compressionLevel || 'basic';
  const retainNokiaFields = this.conf?.retainNokiaFields || false;
  
  // Essential fields to always keep
  const essentialFields = [
    '_time', '_raw', 'host', 'source', 'message', 'severity', 'facility',
    'vendor', 'product', 'device_type', 'event_category', 'event_type',
    'event_id', 'event_name', 'criticality', 'user', 'src_ip'
  ];
  
  // Device-specific essential fields
  const deviceSpecificFields = {
    '7750_sr': [
      'process_name', 'process_id', 'card_slot', 'card_state',
      'session_id', 'management_interface', 'config_action',
      'config_source', 'config_destination', 'interface', 'interface_speed'
    ],
    'mag_c': [
      'application', 'gateway_id', 'system_group', 'reference_point',
      'apn', 'peer_ip', 'session_action', 'alert_type', 'alert_action'
    ]
  };
  
  // Add device-specific fields to essential list
  if (deviceSpecificFields[deviceType]) {
    essentialFields.push(...deviceSpecificFields[deviceType]);
  }
  
  // Fields to remove (redundant after normalization)
  const fieldsToRemove = [
    'nokia_processed'
  ];
  
  // Add fields to remove based on retention setting
  if (!retainNokiaFields) {
    fieldsToRemove.push(
      'nokia_device_type',
      'nokia_timestamp',
      'nokia_hostname',
      'nokia_structured_data'
    );
    
    // Remove Nokia-specific fields that have been normalized
    if (deviceType === '7750_sr') {
      fieldsToRemove.push(
        'nokia_process',
        'nokia_pid',
        'nokia_card1',
        'nokia_card2',
        'nokia_card_id',
        'nokia_source_file',
        'nokia_num',
        'nokia_card_state',
        'nokia_syslog_severity',
        'nokia_perceived_severity',
        'nokia_category',
        'nokia_cause',
        'nokia_details',
        'nokia_xpath',
        'nokia_login',
        'nokia_session',
        'nokia_ipaddress',
        'nokia_srcmanager'
      );
    } else if (deviceType === 'mag_c') {
      fieldsToRemove.push(
        'nokia_sequence',
        'nokia_timezone',
        'nokia_router',
        'nokia_application',
        'nokia_subject_message',
        'nokia_cleaned_message',
        'nokia_gateway_id',
        'nokia_system_group_id'
      );
    }
  }
  
  // Remove redundant fields
  fieldsToRemove.forEach(field => {
    delete event[field];
  });
  
  // Message compression based on device type and compression level
  if (event.message && compressionLevel !== 'none') {
    let msg = event.message;
    
    if (deviceType === '7750_sr') {
      // Nokia 7750 SR message compression
      const compressions = [
        { pattern: /Configuration was copied via command, Details:from:\s*([^,]+),\s*to:\s*([^,]+)/, replacement: 'Config copied: $1→$2' },
        { pattern: /File transfer requested by user, Details:from:\s*([^,]+)\s*to:\s*([^,]+)/, replacement: 'File transfer: $1→$2' },
        { pattern: /Card (\S+) changed from (\w+) to (\w+)/, replacement: 'Card $1: $2→$3' },
        { pattern: /Interface (\S+) changed from (\w+) to (\w+)/, replacement: 'IF $1: $2→$3' }
      ];
      
      // Aggressive compression patterns
      if (compressionLevel === 'aggressive') {
        compressions.push(
          { pattern: /User authentication (successful|failed) from (.+)/, replacement: 'Auth $1: $2' },
          { pattern: /Details:([^,]+),\s*Xpath:([^,]+)/, replacement: 'Path:$2' },
          { pattern: /Session:(\d+), Login:(\w+), IpAddress:([\d.]+)/, replacement: 'Sess:$1 User:$2 IP:$3' }
        );
      }
      
      for (const comp of compressions) {
        if (comp.pattern.test(msg)) {
          const newMsg = msg.replace(comp.pattern, comp.replacement);
          if (newMsg.length < msg.length) {
            msg = newMsg;
            event.message_compressed = true;
            break;
          }
        }
      }
      
    } else if (deviceType === 'mag_c') {
      // Nokia MAG-c message compression (original logic)
      const compressions = [
        { pattern: /CAM utilization alarm (major|minor): Gw- (\S+)/, replacement: 'CAM util $1: GW$2' },
        { pattern: /Association state changed to (\w+) for (\w+) Peer/, replacement: 'Assoc $2→$1' },
        { pattern: /CUPS BNG Session (\w+): Gw (\S+)/, replacement: 'BNG Sess $1: GW$2' },
        { pattern: /ABS Alarm State: (\w+): Gw-(\S+)/, replacement: 'ABS $1: GW$2' }
      ];
      
      // Aggressive MAG-c compression
      if (compressionLevel === 'aggressive') {
        compressions.push(
          { pattern: /Number of Hot Groups-(\d+)/, replacement: 'Hot:$1' },
          { pattern: /Number Of Warm Groups-(\d+)/, replacement: 'Warm:$1' },
          { pattern: /Number Of Cold Groups-(\d+)/, replacement: 'Cold:$1' }
        );
      }
      
      for (const comp of compressions) {
        if (comp.pattern.test(msg)) {
          const newMsg = msg.replace(comp.pattern, comp.replacement);
          if (newMsg.length < msg.length) {
            msg = newMsg;
            event.message_compressed = true;
            break;
          }
        }
      }
    }
    
    event.message = msg;
  }
  
  // Remove NULL values and empty fields (common in Nokia logs)
  Object.keys(event).forEach(key => {
    if (event[key] === 'NULL' || event[key] === null ||
        event[key] === undefined || event[key] === '') {
      delete event[key];
    }
  });
  
  // Add processing metadata
  event.processed_by = 'nokia_enhanced_pack';
  event.pack_version = '3.0.0';
  
  return event;
};
