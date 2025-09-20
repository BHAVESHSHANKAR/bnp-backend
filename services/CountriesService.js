const axios = require('axios');
require('dotenv').config();

class CountriesService {
  constructor() {
    this.apiKey = process.env.RAPIDAPI_KEY;
    this.apiHost = process.env.RAPIDAPI_HOST;
    this.baseUrl = `https://${this.apiHost}`;
  }

  async getAllCountries() {
    const options = {
      method: 'GET',
      url: `${this.baseUrl}/basic`,
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': this.apiHost
      }
    };

    try {
      const response = await axios.request(options);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Error fetching countries:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }

  async getCountryByCode(countryCode) {
    try {
      const countries = await this.getAllCountries();
      if (!countries.success) {
        return countries;
      }

      const country = countries.data.find(c => 
        c.code === countryCode.toUpperCase() || 
        c.iso3 === countryCode.toUpperCase()
      );

      return {
        success: true,
        data: country || null
      };
    } catch (error) {
      console.error('Error fetching country by code:', error.message);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // Get countries with phone codes
  async getCountriesWithPhoneCodes() {
    try {
      const countries = await this.getAllCountries();
      if (!countries.success) {
        return countries;
      }

      // Filter and format countries with phone codes
      const formattedCountries = countries.data
        .filter(country => country.phone_code)
        .map(country => ({
          name: country.name,
          code: country.code,
          iso3: country.iso3,
          phone_code: country.phone_code,
          flag: country.flag || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: formattedCountries
      };
    } catch (error) {
      console.error('Error fetching countries with phone codes:', error.message);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  }
}

module.exports = new CountriesService();