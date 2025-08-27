exports.name = 'nokia_enhanced_normalize';
exports.version = '3.0.0';
exports.disabled = false;
exports.group = 'Nokia Enhanced';

exports.process = (event) => {
  if (!event.nokia_processed) return event;
  
  const deviceType = event.nokia_device_type;
  
  // Common normalization
  event.vendor = 'nokia';
  event.log_source_type = 'network_device';
  
  if (deviceType === '7750_sr') {
    // Nokia 7750 SR normalization
    if (event.nokia_hostname) {
      event.host = event.nokia_hostname;
      event.source = event.nokia_hostname;
    }
    
    if (event.nokia_process) {
      event.process_name = event.nokia_process;
    }
    
    if (event.nokia_pid) {
      event.process_id = parseInt(event.nokia_pid);
    }
    
    // Map Nokia 7750 severity
    if (event.nokia_perceived_severity) {
      const severityMap = {
        'CRITICAL': 'critical',
        'MAJOR': 'major',
        'MINOR': 'minor',
        'WARNING': 'warning',
        'CLEAR': 'clear',
        'CLEARED': 'clear',
        'INFO': 'info'
      };
      event.severity = severityMap[event.nokia_perceived_severity] || event.nokia_perceived_severity.toLowerCase();
      event.log_level = event.severity;
    }
    
    // Build comprehensive message from cause and details
    let messageParts = [];
    if (event.nokia_cause) {
      messageParts.push(event.nokia_cause);
    }
    if (event.nokia_details && event.nokia_details !== event.nokia_cause) {
      messageParts.push(`Details:${event.nokia_details}`);
    }
    event.message = messageParts.join(', ') || event.nokia_cause || 'Nokia 7750 SR event';
    
    // Card information
    if (event.nokia_card_slot) {
      event.card_slot = event.nokia_card_slot;
    }
    if (event.nokia_card_state) {
      event.card_state = event.nokia_card_state;
    }
    
    // Event information
    if (event.nokia_id) {
      event.event_id = event.nokia_id;
    }
    if (event.nokia_name) {
      event.event_name = event.nokia_name;
    }
    
    // User and session info
    if (event.nokia_login) {
      event.user = event.nokia_login;
    }
    if (event.nokia_session) {
      event.session_id = event.nokia_session.toString();
    }
    if (event.nokia_ipaddress) {
      event.src_ip = event.nokia_ipaddress;
    }
    if (event.nokia_srcmanager) {
      event.management_interface = event.nokia_srcmanager;
    }
    
    // Configuration changes
    if (event.nokia_config_source) {
      event.config_source = event.nokia_config_source;
    }
    if (event.nokia_config_destination) {
      event.config_destination = event.nokia_config_destination;
    }
    
    // Interface information
    if (event.nokia_interface_name) {
      event.interface = event.nokia_interface_name;
    }
    if (event.nokia_interface_speed) {
      event.interface_speed = event.nokia_interface_speed;
    }
    
    // XPath information
    if (event.nokia_xpath) {
      event.configuration_path = event.nokia_xpath;
    }
    
  } else if (deviceType === 'mag_c') {
    // Nokia MAG-c normalization (original logic)
    if (event.nokia_hostname || event.nokia_router) {
      event.host = event.nokia_hostname || event.nokia_router;
      event.source = event.host;
    }
    
    if (event.nokia_severity) {
      event.severity = event.nokia_severity.toLowerCase();
      event.log_level = event.severity;
    }
    
    if (event.nokia_application) {
      event.application = event.nokia_application;
      event.process_name = event.nokia_application;
    }
    
    if (event.nokia_event_id) {
      event.event_id = parseInt(event.nokia_event_id);
    }
    
    // Build message
    const messageFields = ['nokia_cleaned_message', 'nokia_message', 'nokia_subject_message'];
    for (const field of messageFields) {
      if (event[field]) {
        event.message = event[field];
        break;
      }
    }
    
    // MAG-c specific fields
    if (event.nokia_gateway_id) {
      event.gateway_id = event.nokia_gateway_id;
    }
    if (event.nokia_system_group_id) {
      event.system_group = event.nokia_system_group_id;
    }
  }
  
  // Common facility mapping
  if (event.nokia_facility !== undefined) {
    const facilityMap = {
      0: 'kernel', 1: 'user', 2: 'mail', 3: 'daemon', 4: 'security',
      5: 'syslogd', 6: 'lpr', 7: 'news', 8: 'uucp', 9: 'cron',
      10: 'authpriv', 11: 'ftp', 16: 'local0', 17: 'local1',
      18: 'local2', 19: 'local3', 20: 'local4', 21: 'local5',
      22: 'local6', 23: 'local7'
    };
    event.facility = facilityMap[event.nokia_facility] || 'syslogd';
  } else {
    // Default facility for Nokia logs
    event.facility = 'syslogd';
  }
  
  return event;
};
