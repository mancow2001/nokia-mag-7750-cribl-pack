// Enhanced Nokia Enrichment - Handles Both Device Types
exports.name = 'nokia_enhanced_enrich';
exports.version = '3.0.0';
exports.disabled = false;
exports.group = 'Nokia Enhanced';

exports.process = (event) => {
  if (!event.nokia_processed) return event;
  
  const deviceType = event.nokia_device_type;
  
  // Set severity scoring
  const severityScores = {
    'critical': 100,
    'major': 90,
    'minor': 70,
    'warning': 60,
    'info': 40,
    'clear': 20,
    'cleared': 20
  };
  
  if (event.severity && severityScores[event.severity]) {
    event.severity_score = severityScores[event.severity];
  }
  
  // Set criticality
  if (event.severity_score) {
    if (event.severity_score >= 90) {
      event.criticality = 'critical';
    } else if (event.severity_score >= 70) {
      event.criticality = 'high';
    } else if (event.severity_score >= 50) {
      event.criticality = 'medium';
    } else {
      event.criticality = 'low';
    }
  }
  
  if (deviceType === '7750_sr') {
    // Nokia 7750 SR specific enrichment
    
    // Event categorization based on event name
    if (event.event_name) {
      const eventName = event.event_name.toLowerCase();
      
      if (eventName.includes('config') || eventName.includes('copy')) {
        event.event_category = 'system';
        event.event_type = 'configuration_change';
        if (eventName.includes('copy')) event.config_action = 'copy';
        else if (eventName.includes('save')) event.config_action = 'save';
        else if (eventName.includes('load')) event.config_action = 'load';
        else if (eventName.includes('delete')) event.config_action = 'delete';
        
      } else if (eventName.includes('transfer') || eventName.includes('file')) {
        event.event_category = 'system';
        event.event_type = 'file_transfer';
        
      } else if (eventName.includes('login') || eventName.includes('logout') || eventName.includes('auth')) {
        event.event_category = 'security';
        event.event_type = 'authentication';
        
      } else if (eventName.includes('interface') || eventName.includes('port')) {
        event.event_category = 'network';
        event.event_type = 'interface_event';
        
      } else if (eventName.includes('card') || eventName.includes('chassis')) {
        event.event_category = 'hardware';
        event.event_type = 'hardware_event';
        
      } else if (eventName.includes('alarm') || eventName.includes('fault')) {
        event.event_category = 'alarm';
        event.event_type = 'system_alarm';
        
      } else {
        event.event_category = 'general';
        event.event_type = 'system_event';
      }
    }
    
    // Category-based enrichment
    if (event.nokia_category) {
      const category = event.nokia_category.toLowerCase();
      if (category === 'general') {
        event.operational_category = 'general_operations';
      } else if (category === 'security') {
        event.operational_category = 'security_operations';
      } else if (category === 'network') {
        event.operational_category = 'network_operations';
      } else if (category === 'equipment') {
        event.operational_category = 'hardware_operations';
      }
    }
    
    // Process-based enrichment
    if (event.process_name) {
      const processDescriptions = {
        'notfmgrd': 'Notification Manager Daemon',
        'cfgmgr': 'Configuration Manager',
        'snmpd': 'SNMP Daemon',
        'chassisd': 'Chassis Daemon',
        'ospfd': 'OSPF Daemon',
        'bgpd': 'BGP Daemon',
        'ldpd': 'LDP Daemon',
        'rsvpd': 'RSVP Daemon',
        'vrrpd': 'VRRP Daemon'
      };
      event.process_description = processDescriptions[event.process_name] || event.process_name;
    }
    
    // State change detection
    if (event.message && event.message.toLowerCase().includes('changed')) {
      event.state_change = true;
      
      // Extract state change details
      const stateMatch = event.message.match(/changed from (\w+) to (\w+)/i);
      if (stateMatch) {
        event.previous_state = stateMatch[1].toLowerCase();
        event.new_state = stateMatch[2].toLowerCase();
      }
    }
    
  } else if (deviceType === 'mag_c') {
    // Nokia MAG-c specific enrichment (original logic)
    
    if (event.nokia_application) {
      const app = event.nokia_application;
      const eventId = parseInt(event.event_id) || 0;
      
      switch (app) {
        case 'MC_REDUNDANCY':
          event.event_category = 'redundancy';
          event.event_type = 'multi_chassis_redundancy';
          if (eventId === 5002) event.event_subtype = 'master_lock_conflict';
          else if (eventId === 2040) event.event_subtype = 'geo_redundancy_change';
          else if (eventId === 5001) event.event_subtype = 'icr_monitor_alarm';
          break;
          
        case 'MOBILE_CUPS_BNG':
          event.event_category = 'mobile_network';
          event.event_type = 'cups_bng';
          if (eventId >= 2001 && eventId <= 2012) {
            event.event_subtype = 'session_management';
          }
          break;
          
        case 'MOBILE_GATEWAY':
          event.event_category = 'mobile_network';
          event.event_type = 'mobile_gateway';
          // Subcategorize based on event ID ranges
          if (eventId >= 2001 && eventId <= 2050) {
            event.event_subtype = 'connection_management';
          } else if (eventId >= 2051 && eventId <= 2100) {
            event.event_subtype = 'resource_management';
          } else if (eventId >= 2101 && eventId <= 2150) {
            event.event_subtype = 'alarm_management';
          }
          break;
          
        case 'SYSTEM':
          event.event_category = 'system';
          event.event_type = 'system_event';
          break;
          
        case 'USER':
          event.event_category = 'security';
          event.event_type = 'user_activity';
          break;
          
        default:
          event.event_category = 'general';
          event.event_type = 'application_event';
      }
    }
    
    // Message-based enrichment for MAG-c
    if (event.message) {
      const msg = event.message.toLowerCase();
      
      // Alarm state analysis
      if (msg.includes('alarm') && (msg.includes('major') || msg.includes('minor') || msg.includes('critical'))) {
        event.alert_type = 'alarm';
        if (msg.includes('clear')) {
          event.alert_action = 'cleared';
        } else {
          event.alert_action = 'raised';
        }
      }
      
      // Session management
      if (msg.includes('session')) {
        if (msg.includes('create')) event.session_action = 'created';
        else if (msg.includes('delete') || msg.includes('terminate')) event.session_action = 'terminated';
        else if (msg.includes('modify')) event.session_action = 'modified';
      }
    }
  }
  
  // Common enrichment for both device types
  
  // Network element identification
  if (event.host) {
    event.network_element = event.host;
  }
  
  // Management interface enrichment
  if (event.management_interface) {
    const interfaceDescriptions = {
      'netconf': 'NETCONF Protocol',
      'snmp': 'Simple Network Management Protocol',
      'cli': 'Command Line Interface',
      'rest': 'REST API',
      'ssh': 'Secure Shell',
      'telnet': 'Telnet Protocol'
    };
    event.management_protocol = interfaceDescriptions[event.management_interface] || event.management_interface;
  }
  
  // Add operational context
  if (event.event_category === 'system' && event.user) {
    event.operational_impact = 'configuration_change';
  } else if (event.event_category === 'hardware') {
    event.operational_impact = 'hardware_status';
  } else if (event.event_category === 'network') {
    event.operational_impact = 'network_connectivity';
  }
  
  return event;
};
